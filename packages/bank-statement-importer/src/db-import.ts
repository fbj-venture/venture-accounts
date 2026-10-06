// Uses the unpooled/direct connection (not the default pooled "@app/db")
// since this imports many rows in a loop - a real connection/pool suits
// that better than a fresh HTTP request per query.
import { account, bankAccount, db, journal, journalLine, withCreate } from "@app/db/direct";
import type { Transaction } from "@app/models";
import { eq } from "drizzle-orm";

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
    .limit(1);

  return { found: Boolean(row), account: row?.account, bankAccount: row?.bankAccount };
}

export type ImportRowProgress =
  | { status: "imported"; index: number; total: number; transaction: Transaction }
  | { status: "skipped"; index: number; total: number; transaction: Transaction };

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
  const total = transactions.length;

  for (let index = 0; index < transactions.length; index++) {
    const transaction = transactions[index]!;

    const [existingLine] = await db
      .select({ id: journalLine.id })
      .from(journalLine)
      .where(eq(journalLine.hash, transaction.hash))
      .limit(1);

    if (existingLine) {
      onProgress?.({ status: "skipped", index, total, transaction });
      continue;
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
      .returning();

    if (!createdJournal) {
      throw new Error(
        `Failed to create journal entry for transaction hash ${transaction.hash}`,
      );
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
      .returning();

    if (!createdLine) {
      await db.delete(journal).where(eq(journal.id, createdJournal.id));
      continue;
    }

    onProgress?.({ status: "imported", index, total, transaction });
  }
}
