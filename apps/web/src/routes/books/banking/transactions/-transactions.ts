import { db, journal, journalLine } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";

// One row per Journal Line ("posting" in docs/Ledger Ubiquitous Language.md)
// on the account, flattened with its parent Journal Entry ("Transaction" in
// the UI - never show "journal" or "debit"/"credit" to the user).
export type AccountTransaction = Awaited<ReturnType<typeof getUnPostedAccountTransactions>>[number];

export const getUnPostedAccountTransactions = createServerFn({ method: "GET" })
  .validator((accountId: number) => accountId)
  .handler(async ({ data: accountId }) => {
    return db
      .select({
        journalLineId: journalLine.id,
        journalId: journal.id,
        date: journal.date,
        note: journal.note,
        description: journalLine.description,
        amount: journalLine.amount,
      })
      .from(journalLine)
      .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
      .where(
        and(
          eq(journalLine.accountId, accountId),
          eq(journal.isPosted, false)
        )
      )
      .orderBy(asc(journal.date));
  });
