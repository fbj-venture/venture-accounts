import { account, accountType, db, journal, journalLine } from "@app/db/direct"
import { eq, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import {
  postedInPeriod,
  type ReportPeriod,
} from "../../../-server/internal/report-period.server.ts"

// Server-only: used from the handlers in ../trial-balance.server.ts and
// ../trial-balance-export.server.ts, never from client code.

export type TrialBalanceCriteria = ReportPeriod

// The balance of every Account that has a posted Journal Line dated within
// from..to, in the canonical Account Type order and then by the name shown.
// An Account's balance is its signed sum - positive is a debit balance,
// negative a credit balance.
export async function loadTrialBalance(criteria: TrialBalanceCriteria) {
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
    .where(postedInPeriod(criteria))
    .groupBy(account.id, parent.name, accountType.id)

  return rows
    .map(({ balance, parentName, ...row }) => ({
      ...row,
      fullName: parentName ? `${parentName}:${row.name}` : row.name,
      balance: Number(balance),
    }))
    .sort(
      (a, b) =>
        a.accountTypeId - b.accountTypeId ||
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    )
}
