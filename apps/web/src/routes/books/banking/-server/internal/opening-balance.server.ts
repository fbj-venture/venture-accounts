// Server-only: imported only inside server function handlers, so it - and
// the database driver - stay out of the browser bundle (see
// transactions/-components/posting.server.ts).
import { account, accountType, db, journal, journalLine, withCreate } from "@app/db/direct"
import { and, eq, ne } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

// The single Equity account every take-on entry's other line is posted
// against - see docs/Ledger Ubiquitous Language.md ("Opening balance").
export const OPENING_BALANCE_EQUITY_ACCOUNT = "Opening Balance Equity"

// Creates a bank account's take-on entry: a balanced, posted Journal entry
// with one line on the bank account (the take-on amount) and one on Opening
// Balance Equity (the balancing amount). Called only when the bank account is
// created, so it happens once per account. Opening Balance Equity must already
// exist (the database is seeded with it), otherwise this throws. `date` is the
// calendar day as "yyyy-MM-dd".
export async function createOpeningBalanceEntry(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  data: { accountId: number; date: string; note: string; amount: number },
) {
  const [equityAccount] = await tx
    .select({ id: account.id })
    .from(account)
    .where(eq(account.name, OPENING_BALANCE_EQUITY_ACCOUNT))
  if (!equityAccount) {
    throw new Error(
      `"${OPENING_BALANCE_EQUITY_ACCOUNT}" account not found - it must be seeded before a bank account can be created.`,
    )
  }

  // Calendar dates are stored as UTC midnight - see lib/dates.ts.
  const [entry] = await tx
    .insert(journal)
    .values(
      withCreate(userId, {
        date: new Date(`${data.date}T00:00:00Z`),
        note: data.note,
        isPosted: true,
      }),
    )
    .returning({ id: journal.id })

  await tx.insert(journalLine).values(
    withCreate(userId, [
      { journalEntryId: entry!.id, accountId: data.accountId, amount: data.amount },
      { journalEntryId: entry!.id, accountId: equityAccount.id, amount: -data.amount },
    ]),
  )
}

// A bank account's take-on entry: the journal line on this account whose
// entry's other line is posted against the Opening Balance Equity account.
// Its amount (signed, as always - see journal-line.ts) is the take-on
// balance, with its date ("yyyy-MM-dd"); null means no opening balance has
// been set.
export async function findOpeningBalanceEntry(
  accountId: number,
): Promise<{ amount: number; date: string } | null> {
  const equityLine = alias(journalLine, "equity_line")
  const equityAccount = alias(account, "equity_account")

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
    .limit(1)

  return row ? { amount: row.amount, date: row.date.toISOString().slice(0, 10) } : null
}
