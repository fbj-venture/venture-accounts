import { requireAdmin } from "#/lib/require-admin.server.ts";
import { requireUser } from "#/lib/require-user.server.ts";
import { account, bankAccount, db, journal, journalLine } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, exists, gte, inArray, lte, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Keep ALL database code inside handlers - see
// transactions/-components/transactions-fn.ts for why.

export type SearchCriteria = {
  /** Empty: every bank account. */
  bankAccountIds: number[];
  /** Empty: any account. Matches the account on the other side of the bank line. */
  accountIds: number[];
  /** yyyy-MM-dd, inclusive; either end may be missing. */
  from: string | null;
  to: string | null;
  /** null: either way. */
  posted: boolean | null;
  reconciled: boolean | null;
};

export type SearchResult = Awaited<ReturnType<typeof searchTransactions>>[number];

// "yyyy-MM-dd" -> the Date a date column (mode: "date") compares against, on
// the calendar date in UTC so time zones can't shift the day.
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);

const isDay = (day: string | null) => day === null || /^\d{4}-\d{2}-\d{2}$/.test(day);

// One row per bank line (a Journal Line on a bank account - a "transaction"
// in the UI), newest first. Every criterion is optional. The amount
// expression isn't applied here: it's evaluated in the browser, which has
// the parser, over what comes back.
export const searchTransactions = createServerFn({ method: "POST" })
  .validator((data: SearchCriteria) => data)
  .handler(async ({ data }) => {
    await requireUser();
    if (!isDay(data.from) || !isDay(data.to)) {
      throw new Error("The dates are not valid.");
    }

    const bank = alias(account, "bank");
    const otherLine = alias(journalLine, "other_line");
    const otherAccount = alias(account, "other_account");
    const matchLine = alias(journalLine, "match_line");

    const rows = await db
      .select({
        journalLineId: journalLine.id,
        date: journal.date,
        description: journalLine.description,
        note: journal.note,
        amount: journalLine.amount,
        isPosted: journal.isPosted,
        isReconciled: journalLine.isReconciled,
        bankAccountId: bank.id,
        bankAccountName: bank.name,
        otherAccountName: otherAccount.name,
      })
      .from(journalLine)
      .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
      .innerJoin(bankAccount, eq(bankAccount.id, journalLine.accountId))
      .innerJoin(bank, eq(bank.id, bankAccount.id))
      .leftJoin(
        otherLine,
        and(eq(otherLine.journalEntryId, journal.id), ne(otherLine.id, journalLine.id)),
      )
      .leftJoin(otherAccount, eq(otherAccount.id, otherLine.accountId))
      .where(
        and(
          data.bankAccountIds.length ? inArray(journalLine.accountId, data.bankAccountIds) : undefined,
          data.from ? gte(journal.date, toDate(data.from)) : undefined,
          data.to ? lte(journal.date, toDate(data.to)) : undefined,
          data.posted === null ? undefined : eq(journal.isPosted, data.posted),
          data.reconciled === null ? undefined : eq(journalLine.isReconciled, data.reconciled),
          data.accountIds.length
            ? exists(
                db
                  .select({ one: matchLine.id })
                  .from(matchLine)
                  .where(
                    and(
                      eq(matchLine.journalEntryId, journal.id),
                      ne(matchLine.id, journalLine.id),
                      inArray(matchLine.accountId, data.accountIds),
                    ),
                  ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(journal.date), desc(journalLine.id), asc(otherAccount.name));

    // An entry split across several accounts repeats its bank line once per
    // other line - fold those back into one row listing every account.
    const byLine = new Map<number, Omit<(typeof rows)[number], "otherAccountName"> & { otherAccountNames: string[] }>();
    for (const { otherAccountName, ...row } of rows) {
      const existing = byLine.get(row.journalLineId) ?? { ...row, otherAccountNames: [] };
      if (otherAccountName) {
        existing.otherAccountNames.push(otherAccountName);
      }
      byLine.set(row.journalLineId, existing);
    }
    return [...byLine.values()].map(({ description, note, ...row }) => ({
      ...row,
      description: description ?? note,
    }));
  });

export type TransactionIds = Awaited<ReturnType<typeof getTransactionIds>>;

// The database ids behind a search result: its journal entry, and every
// journal line in it with the account each is on. For administrators only -
// the table only offers this to them, and the check is repeated here because
// server functions are open to any signed-in user.
export const getTransactionIds = createServerFn({ method: "POST" })
  .validator((journalLineId: number) => journalLineId)
  .handler(async ({ data: journalLineId }) => {
    await requireAdmin();
    const [bankLine] = await db
      .select({ journalId: journalLine.journalEntryId })
      .from(journalLine)
      .where(eq(journalLine.id, journalLineId));
    if (!bankLine) {
      throw new Error("Transaction not found.");
    }
    const lines = await db
      .select({
        journalLineId: journalLine.id,
        accountId: account.id,
        accountName: account.name,
      })
      .from(journalLine)
      .innerJoin(account, eq(account.id, journalLine.accountId))
      .where(eq(journalLine.journalEntryId, bankLine.journalId))
      .orderBy(asc(journalLine.id));
    return {
      journalId: bankLine.journalId,
      clickedJournalLineId: journalLineId,
      lines,
    };
  });

// Whether the signed-in user is an administrator, as the server sees them -
// the same check getTransactionIds enforces, so the page only offers the ids
// to someone the server will actually give them to.
export const getIsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
});
