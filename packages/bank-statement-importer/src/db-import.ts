// Uses the pooled pg connection from "@app/db/direct", which suits importing
// many rows in a loop.
import {
  account,
  bankAccount,
  bankUpload,
  db,
  journal,
  journalAttachment,
  journalLine,
  withCreate,
  withUpdate,
} from "@app/db/direct"
import type { Transaction } from "@app/models"
import { and, asc, eq, exists, isNull, sql } from "drizzle-orm"

// "Account" is overloaded (see docs/Ledger Ubiquitous Language.md): this
// looks up the ledger Account - what a Journal Line actually references -
// via the real-world bank account number extracted from a statement's
// header, joining through bankAccount (the 1:1 real-world details).
export async function findAccountByBankAccountNumber(accountNumber: string) {
  const [row] = await db
    .select({ account, bankAccount })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .where(eq(bankAccount.accountNumber, accountNumber))
    .limit(1)

  return { found: Boolean(row), account: row?.account, bankAccount: row?.bankAccount }
}

// Records an uploaded statement so it can be found again later. The file lives
// in file storage under `fileKey`, which is what's saved (not a URL - the
// bucket is private and download links are temporary, see getFileUrl in
// @app/storage). A statement is stored under one key per account and date, so
// re-importing it overwrites the file; the existing record is kept rather
// than adding a second one for the same file - but its description is updated,
// since the person re-importing may have worded it differently.
export async function recordBankUpload(
  bankId: number,
  fileKey: string,
  fileHash: string,
  description: string,
  userId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: bankUpload.id })
    .from(bankUpload)
    .where(and(eq(bankUpload.bankId, bankId), eq(bankUpload.fileUrl, fileKey)))
    .limit(1)
  if (existing) {
    await db
      .update(bankUpload)
      .set(withUpdate(userId, { description, fileHash }))
      .where(eq(bankUpload.id, existing.id))
    return
  }
  await db
    .insert(bankUpload)
    .values(withCreate(userId, { bankId, description, fileUrl: fileKey, fileHash }))
}

// The bank line of an expense added by hand: on this bank account, same date
// and amount as the statement row, no import hash yet, not reconciled, and
// carrying a receipt (journal_attachment) - which is what tells it from the
// opening balance and other hash-less lines. The oldest such line is
// claimed, so two identical rows on a statement match two hand-entered
// expenses one each. Returns whether one was claimed.
//
// The statement's text becomes the entry's note, as for any imported row.
// The description the person typed stays on the lines (journal_line.description),
// which is what the Post screen shows and fills its note box from.
async function claimManualExpense(
  transaction: Transaction,
  accountId: number,
  userId: string,
): Promise<boolean> {
  const [manualLine] = await db
    .select({ id: journalLine.id, journalId: journal.id })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .where(
      and(
        eq(journalLine.accountId, accountId),
        isNull(journalLine.hash),
        eq(journalLine.amount, transaction.amount),
        eq(journalLine.isReconciled, false),
        eq(journal.date, transaction.date),
        exists(
          db
            .select({ one: sql`1` })
            .from(journalAttachment)
            .where(eq(journalAttachment.journalLineId, journalLine.id)),
        ),
      ),
    )
    .orderBy(asc(journalLine.id))
    .limit(1)
  if (!manualLine) {
    return false
  }
  await db.transaction(async (tx) => {
    await tx
      .update(journalLine)
      .set(withUpdate(userId, { hash: transaction.hash }))
      .where(eq(journalLine.id, manualLine.id))
    await tx
      .update(journal)
      .set(withUpdate(userId, { note: transaction.details }))
      .where(eq(journal.id, manualLine.journalId))
  })
  return true
}

export type ImportRowProgress =
  | { status: "imported"; index: number; total: number; transaction: Transaction }
  | { status: "skipped"; index: number; total: number; transaction: Transaction }

// Imports each Transaction as a Journal Entry (one per row) with a single
// Journal Line against `ledgerAccount`. NOTE: this is not yet real
// double-entry - each Journal Entry's one line won't sum to zero, since
// there's no counter-account (expense/income category) categorization yet.
// serviceFee also isn't recorded separately. Both are known gaps to close
// before this can be trusted as real ledger data.
export async function importTransactions(
  transactions: Transaction[],
  ledgerAccount: typeof account.$inferSelect,
  userId: string,
  onProgress?: (progress: ImportRowProgress) => void,
): Promise<void> {
  const total = transactions.length

  for (let index = 0; index < transactions.length; index++) {
    const transaction = transactions[index]!

    const [existingLine] = await db
      .select({ id: journalLine.id })
      .from(journalLine)
      .where(eq(journalLine.hash, transaction.hash))
      .limit(1)

    if (existingLine) {
      onProgress?.({ status: "skipped", index, total, transaction })
      continue
    }

    // An expense added by hand (with its receipt photo) before the statement
    // arrived: take the statement's row as that line rather than adding a
    // second one. It gets the row's import hash, so a re-import skips it.
    if (await claimManualExpense(transaction, ledgerAccount.id, userId)) {
      onProgress?.({ status: "skipped", index, total, transaction })
      continue
    }

    // Creating the Journal entry
    const [createdJournal] = await db
      .insert(journal)
      .values(
        withCreate(userId, {
          date: transaction.date,
          note: transaction.details,
        }),
      )
      .returning()

    if (!createdJournal) {
      throw new Error(`Failed to create journal entry for transaction hash ${transaction.hash}`)
    }

    // Creating the Journal Line
    const [createdLine] = await db
      .insert(journalLine)
      .values(
        withCreate(userId, {
          journalEntryId: createdJournal.id,
          accountId: ledgerAccount.id,
          amount: transaction.amount,
          hash: transaction.hash,
        }),
      )
      .returning()

    if (!createdLine) {
      await db.delete(journal).where(eq(journal.id, createdJournal.id))
      continue
    }

    onProgress?.({ status: "imported", index, total, transaction })
  }
}
