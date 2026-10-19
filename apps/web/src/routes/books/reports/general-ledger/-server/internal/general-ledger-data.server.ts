import { account, accountType, db, journal, journalLine } from "@app/db/direct"
import { asc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import {
  postedInPeriod,
  type ReportPeriod,
} from "../../../-server/internal/report-period.server.ts"

// Server-only: used from the handlers in ../general-ledger.server.ts and
// ../general-ledger-export.server.ts, never from client code.

export type GeneralLedgerCriteria = ReportPeriod

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
