import { requireUser } from "#/lib/require-user.server.ts";
import { account, bankAccount, db, journal, journalLine, withUpdate } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { postToCategory, postTransfer } from "./posting.server.ts";

// Keep ALL database code inside handlers (or in posting.server.ts, used only
// from a handler). This file is imported by the route tree, so it's in the
// browser bundle; TanStack Start strips handler bodies and the imports only
// they use, but not other module-level code - which would drag the database
// driver into the browser and stop the whole app hydrating (even login).

// One row per Journal Line ("posting" in docs/Ledger Ubiquitous Language.md)
// on the account, flattened with its parent Journal Entry ("Transaction" in
// the UI - never show "journal" or "debit"/"credit" to the user).
export type AccountTransaction = Awaited<ReturnType<typeof getUnPostedAccountTransactions>>[number];

export const getUnPostedAccountTransactions = createServerFn({ method: "GET" })
  .validator((accountId: number) => accountId)
  .handler(async ({ data: accountId }) => {
    // The entry's other Journal Line(s) - the side already saved against a
    // Category, or the other bank's line for a matched Transfer - so the
    // table can show which account was chosen.
    const otherLine = alias(journalLine, "other_line");
    const rows = await db
      .select({
        journalLineId: journalLine.id,
        journalId: journal.id,
        date: journal.date,
        note: journal.note,
        description: journalLine.description,
        amount: journalLine.amount,
        otherAccountId: otherLine.accountId,
      })
      .from(journalLine)
      .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
      .leftJoin(
        otherLine,
        and(eq(otherLine.journalEntryId, journal.id), ne(otherLine.id, journalLine.id)),
      )
      .where(
        and(
          eq(journalLine.accountId, accountId),
          eq(journal.isPosted, false)
        )
      )
      .orderBy(asc(journal.date), asc(journalLine.id), asc(otherLine.id));

    // Saving only ever adds one other line, but an entry split across
    // several would repeat the bank line once per split - keep the first so
    // there's still one row per bank line.
    const seen = new Set<number>();
    return rows.filter((row) => {
      if (seen.has(row.journalLineId)) {
        return false;
      }
      seen.add(row.journalLineId);
      return true;
    });
  });

// Saves the other side of a bank transaction - the second half of its
// double entry. Picking a Category adds (or moves) a balancing line on that
// Category; picking a Bank matches it up as a Transfer (see postTransfer in
// posting.server.ts). With should_post it also marks the entry posted, so it
// drops off the un-posted list. Runs in one database transaction, so any
// failure leaves nothing half-saved.
export const postTransaction = createServerFn({ method: "POST" })
  .validator((data: {
    journalLineId: number;
    accountId: number,
    should_post: boolean;
  }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser();
    await db.transaction(async (tx) => {
      // Lock the entry so two saves on the same transaction can't both
      // add a balancing line, or race to change it.
      const [bankLine] = await tx
        .select({
          journalId: journal.id,
          accountId: journalLine.accountId,
          amount: journalLine.amount,
          date: journal.date,
          isPosted: journal.isPosted,
          description: journalLine.description,
          note: journal.note,
        })
        .from(journalLine)
        .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
        .where(eq(journalLine.id, data.journalLineId))
        .for("update", { of: journal });
      if (!bankLine) {
        throw new Error("Transaction not found.");
      }
      if (bankLine.isPosted) {
        throw new Error("Transaction has already been posted.");
      }

      const [target] = await tx
        .select({ id: account.id, name: account.name, bankAccountId: bankAccount.id })
        .from(account)
        .leftJoin(bankAccount, eq(bankAccount.id, account.id))
        .where(eq(account.id, data.accountId));
      if (!target) {
        throw new Error("Account not found.");
      }

      if (target.bankAccountId !== null) {
        await postTransfer(tx, data.journalLineId, bankLine, target, userId);
      } else {
        await postToCategory(tx, data.journalLineId, bankLine, target.id, userId);
      }

      if (data.should_post) {
        await tx
          .update(journal)
          .set(withUpdate(userId, { isPosted: true }))
          .where(eq(journal.id, bankLine.journalId));
      }
    });
  });
