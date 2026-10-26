import { expenseProblems } from "#/lib/expense-entry.ts"
import {
  account,
  accountType,
  bankAccount,
  db,
  journal,
  journalAttachment,
  journalLine,
  withCreate,
} from "@app/db/direct"
import { deleteFile, isStorageConfigured, uploadFile } from "@app/storage"
import { and, eq } from "drizzle-orm"

export type NewExpense = {
  bankAccountId: number
  expenseAccountId: number
  /** The calendar day as "yyyy-MM-dd". */
  date: string
  description: string
  /** In rand, positive: money going out of the bank account. */
  amount: number
  photo: File
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

// Adds an expense paid from a bank account as one balanced, unposted Journal
// entry: a line taking the amount out of the bank account (negative) and a line
// charging it to the Expense account (positive), both carrying the description,
// plus the photo of the receipt, kept on the bank line. It is left unposted like an imported
// transaction, for the Post screen; when the bank statement carrying it is
// imported later, the importer matches it instead of adding it again (see
// claimManualExpense in @app/bank-statement-importer).
//
// The photo is stored first, so a failure there saves nothing; if saving the
// entry fails after that, the photo is deleted again. Returns the entry's id.
export async function addExpense(expense: NewExpense, userId: string): Promise<number> {
  // The same rules the form checks; the first problem found is reported.
  const problem = Object.values(expenseProblems(expense))[0]
  if (problem) {
    throw new Error(problem)
  }
  if (!isStorageConfigured()) {
    throw new Error("File storage isn't configured, so the photo can't be saved.")
  }

  const [bank] = await db
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .where(
      and(
        eq(bankAccount.id, expense.bankAccountId),
        eq(bankAccount.isArchived, false),
        eq(account.isArchived, false),
      ),
    )
  if (!bank) {
    throw new Error("That bank account isn't available.")
  }
  const [expenseAccount] = await db
    .select({ id: account.id })
    .from(account)
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .where(
      and(
        eq(account.id, expense.expenseAccountId),
        eq(account.isArchived, false),
        eq(accountType.name, "Expense"),
      ),
    )
  if (!expenseAccount) {
    throw new Error("Choose an expense account.")
  }

  const fileKey = `expenses/${crypto.randomUUID()}.${EXTENSIONS[expense.photo.type] ?? "img"}`
  await uploadFile(fileKey, new Uint8Array(await expense.photo.arrayBuffer()), expense.photo.type)

  try {
    return await db.transaction(async (tx) => {
      // The note is a stand-in: the bank statement's own text replaces it when
      // the statement is imported. The description the person typed is kept on
      // the lines, below.
      // Calendar dates are stored as UTC midnight - see lib/dates.ts.
      const [entry] = await tx
        .insert(journal)
        .values(
          withCreate(userId, {
            date: new Date(`${expense.date}T00:00:00Z`),
            note: expense.description,
          }),
        )
        .returning({ id: journal.id })

      const [bankLine] = await tx
        .insert(journalLine)
        .values(
          withCreate(userId, {
            journalEntryId: entry!.id,
            accountId: expense.bankAccountId,
            amount: -expense.amount,
            description: expense.description,
          }),
        )
        .returning({ id: journalLine.id })
      await tx.insert(journalLine).values(
        withCreate(userId, {
          journalEntryId: entry!.id,
          accountId: expense.expenseAccountId,
          amount: expense.amount,
          description: expense.description,
        }),
      )
      // The receipt is kept on the bank line: it is the line the statement
      // import matches with, and the one the bank statement is reconciled against.
      await tx.insert(journalAttachment).values(
        withCreate(userId, {
          journalLineId: bankLine!.id,
          fileKey,
          fileName: expense.photo.name.slice(0, 200) || "photo",
          contentType: expense.photo.type,
        }),
      )
      return entry!.id
    })
  } catch (error) {
    await deleteFile(fileKey).catch(() => {})
    throw error
  }
}
