import { account, accountType, db, journal, journalLine } from "@app/db/direct"
import { and, eq, gte, inArray, lt, lte, notInArray, or, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import {
  CARRIED_FORWARD_TYPES,
  financialYearStartFor,
  postedInPeriod,
  toDate,
  type ReportPeriod,
} from "../../../-server/internal/report-period.server.ts"

// Server-only: used from the handlers in ../trial-balance.server.ts and
// ../trial-balance-export.server.ts, never from client code.

export type TrialBalanceCriteria = ReportPeriod

// The balance of every Account at the end of the period (the "to" date), in the
// canonical Account Type order and then by the name shown. An Account's balance
// is its signed sum - positive is a debit balance, negative a credit balance.
//
// It is the same closing balance the General Ledger ends on: Asset, Liability
// and Equity Accounts carry everything posted up to "to", however long ago;
// Income and Expense Accounts count from the start of the financial year "from"
// falls in (with no "from", from the very beginning).
//
// The earlier years' Income and Expense (profit or loss) are left out of those
// Accounts, so they would no longer balance with the rest. They are shown as
// one Equity line, "Retained earnings (prior financial years)", the way a year
// end would roll them in, which keeps total debits equal to total credits.
export async function loadTrialBalance(criteria: TrialBalanceCriteria) {
  // Throws on a date that isn't one.
  postedInPeriod(criteria)
  const yearStart = criteria.from ? await financialYearStartFor(criteria.from) : null
  const upToEnd = (): SQL | undefined =>
    criteria.to ? lte(journal.date, toDate(criteria.to)) : undefined

  const parent = alias(account, "parent")
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      parentName: parent.name,
      isArchived: account.isArchived,
      accountTypeId: accountType.id,
      accountType: accountType.name,
      balance: sql<string>`sum(${journalLine.amount})`,
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .innerJoin(account, eq(account.id, journalLine.accountId))
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .leftJoin(parent, eq(parent.id, account.parentId))
    .where(
      and(
        eq(journal.isPosted, true),
        upToEnd(),
        yearStart
          ? or(
              inArray(accountType.name, CARRIED_FORWARD_TYPES),
              gte(journal.date, toDate(yearStart)),
            )
          : undefined,
      ),
    )
    .groupBy(account.id, parent.name, accountType.id)

  const result = rows.map(({ balance, parentName, ...row }) => ({
    ...row,
    fullName: parentName ? `${parentName}:${row.name}` : row.name,
    // Whole cents, so the sum carries no floating point dust.
    balance: Math.round(Number(balance) * 100) / 100,
  }))

  if (yearStart) {
    const [prior] = await db
      .select({ total: sql<string>`coalesce(sum(${journalLine.amount}), 0)` })
      .from(journalLine)
      .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
      .innerJoin(account, eq(account.id, journalLine.accountId))
      .innerJoin(accountType, eq(accountType.id, account.account_type))
      .where(
        and(
          eq(journal.isPosted, true),
          upToEnd(),
          lt(journal.date, toDate(yearStart)),
          notInArray(accountType.name, CARRIED_FORWARD_TYPES),
        ),
      )
    const priorCents = Math.round(Number(prior?.total ?? 0) * 100)
    const [equity] = await db
      .select({ id: accountType.id, name: accountType.name })
      .from(accountType)
      .where(eq(accountType.name, "Equity"))
    if (priorCents !== 0 && equity) {
      result.push({
        // Not a real Account.
        id: 0,
        name: RETAINED_EARNINGS,
        isArchived: false,
        accountTypeId: equity.id,
        accountType: equity.name,
        fullName: RETAINED_EARNINGS,
        // The profit or loss of earlier years, as a balance of its own: a profit
        // (a net credit in the Income and Expense Accounts) is a credit here too.
        balance: priorCents / 100,
      })
    }
  }

  return result.sort(
    (a, b) =>
      a.accountTypeId - b.accountTypeId ||
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
  )
}

const RETAINED_EARNINGS = "Retained earnings (prior financial years)"
