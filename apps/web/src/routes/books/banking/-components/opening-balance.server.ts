// Server-only: imported only inside server function handlers, so it - and
// the database driver - stay out of the browser bundle (see
// transactions/-components/posting.server.ts).
import { account, accountType, db, journal, journalLine } from "@app/db/direct";
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// The single Equity account every take-on entry's other line is posted
// against - see docs/Ledger Ubiquitous Language.md ("Opening balance").
export const OPENING_BALANCE_EQUITY_ACCOUNT = "Opening Balance Equity";

// A bank account's take-on entry: the journal line on this account whose
// entry's other line is posted against the Opening Balance Equity account.
// Its amount (signed, as always - see journal-line.ts) is the take-on
// balance; null means no opening balance has been set yet.
export async function findOpeningBalance(accountId: number): Promise<number | null> {
  return (await findOpeningBalanceEntry(accountId))?.amount ?? null;
}

// The same take-on entry with its date ("yyyy-MM-dd"), for when the balance
// is as at a day.
export async function findOpeningBalanceEntry(
  accountId: number,
): Promise<{ amount: number; date: string } | null> {
  const equityLine = alias(journalLine, "equity_line");
  const equityAccount = alias(account, "equity_account");

  const [row] = await db
    .select({ amount: journalLine.amount, date: journal.date })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .innerJoin(
      equityLine,
      and(eq(equityLine.journalEntryId, journal.id), ne(equityLine.id, journalLine.id)),
    )
    .innerJoin(equityAccount, eq(equityAccount.id, equityLine.accountId))
    .innerJoin(accountType, eq(accountType.id, equityAccount.account_type))
    .where(
      and(
        eq(journalLine.accountId, accountId),
        eq(accountType.name, "Equity"),
        eq(equityAccount.name, OPENING_BALANCE_EQUITY_ACCOUNT),
      ),
    )
    .limit(1);

  return row ? { amount: row.amount, date: row.date.toISOString().slice(0, 10) } : null;
}
