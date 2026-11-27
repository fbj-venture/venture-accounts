import { account, accountType, db, journal, journalLine } from "@app/db/direct"
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import {
  CARRIED_FORWARD_TYPES,
  financialYearStartFor,
  postedInPeriod,
  toDate,
  type ReportPeriod,
} from "../../../-server/internal/report-period.server.ts"

// Server-only: used from the handlers in ../general-ledger.server.ts and
// ../general-ledger-export.server.ts, never from client code.

export type GeneralLedgerCriteria = ReportPeriod

// What each Account stood at just before the period starts: every posted line
// dated before "from". Asset, Liability and Equity Accounts carry everything
// before it; Income and Expense Accounts only count from the start of the
// financial year "from" falls in (a period starting on the first day of a
// financial year has none). With no "from" nothing came before the period.
export async function loadOpeningBalances(criteria: GeneralLedgerCriteria) {
  if (criteria.from === null) {
    return []
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(criteria.from)) {
    throw new Error("The dates are not valid.")
  }
  const yearStart = await financialYearStartFor(criteria.from)

  const parent = alias(account, "parent")
  const rows = await db
    .select({
      accountId: account.id,
      name: account.name,
      parentName: parent.name,
      isArchived: account.isArchived,
      accountTypeId: accountType.id,
      accountType: accountType.name,
      opening: sql<string>`coalesce(sum(${journalLine.amount}), 0)`.mapWith(Number),
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .innerJoin(account, eq(account.id, journalLine.accountId))
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .leftJoin(parent, eq(parent.id, account.parentId))
    .where(
      and(
        eq(journal.isPosted, true),
        lt(journal.date, toDate(criteria.from)),
        or(inArray(accountType.name, CARRIED_FORWARD_TYPES), gte(journal.date, toDate(yearStart))),
      ),
    )
    .groupBy(
      account.id,
      account.name,
      parent.name,
      account.isArchived,
      accountType.id,
      accountType.name,
    )

  return rows.map(({ name, parentName, opening, ...row }) => ({
    ...row,
    fullName: parentName ? `${parentName}:${name}` : name,
    // Whole cents, so the sum carries no floating point dust.
    opening: Math.round(opening * 100) / 100,
  }))
}

// Every posted Journal Line dated within from..to, by Account (in the
// canonical Account Type order, then the name shown) and, within an Account,
// oldest first. Filtering by Account Type and archived Accounts and the
// grouping into sections is left to the caller (see general-ledger-rows.ts).
export async function loadGeneralLedger(criteria: GeneralLedgerCriteria) {
  const parent = alias(account, "parent")
  const rows = await db
    .select({
      id: journalLine.id,
      accountId: account.id,
      name: account.name,
      parentName: parent.name,
      isArchived: account.isArchived,
      accountTypeId: accountType.id,
      accountType: accountType.name,
      date: journal.date,
      note: journal.note,
      description: journalLine.description,
      amount: journalLine.amount,
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .innerJoin(account, eq(account.id, journalLine.accountId))
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .leftJoin(parent, eq(parent.id, account.parentId))
    .where(postedInPeriod(criteria))
    .orderBy(asc(journal.date), asc(journal.id), asc(journalLine.id))

  // The sort is stable, so each Account keeps its lines in date order.
  return rows
    .map(({ name, parentName, ...row }) => ({
      ...row,
      fullName: parentName ? `${parentName}:${name}` : name,
    }))
    .sort(
      (a, b) =>
        a.accountTypeId - b.accountTypeId ||
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    )
}
