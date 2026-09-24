import { account, bankAccount, db, journal, journalLine } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// One row per Journal Line ("posting" in docs/Ledger Ubiquitous Language.md)
// on the account, flattened with its parent Journal Entry ("Transaction" in
// the UI - never show "journal" or "debit"/"credit" to the user).
export type AccountTransaction = Awaited<ReturnType<typeof getUnPostedAccountTransactions>>[number];

export const getUnPostedAccountTransactions = createServerFn({ method: "GET" })
  .validator((accountId: number) => accountId)
  .handler(async ({ data: accountId }) => {
    // The entry's other Journal Line(s) - the side already saved against a
    // Category - so the table can show which account was chosen.
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

// Categorises a bank transaction: adds the second half of the double entry -
// a Journal Line on the chosen Category for the amount that balances the
// Journal Entry to zero - or, if that line already exists, moves it to the
// chosen Category. With should_post it also marks the entry posted, so it
// drops off the un-posted list. Bank accounts are rejected; transfers need
// their own flow since the other bank's statement brings in its own side of
// the entry.
export const postTransaction = createServerFn({ method: "POST" })
  .validator((data: {
    journalLineId: number;
    accountId: number,
    should_post: boolean;
  }) => data)
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      // Lock the entry so two saves on the same transaction can't both
      // add a balancing line, or race to change it.
      const [bankLine] = await tx
        .select({
          journalId: journal.id,
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

      const [category] = await tx
        .select({ id: account.id, bankAccountId: bankAccount.id })
        .from(account)
        .leftJoin(bankAccount, eq(bankAccount.id, account.id))
        .where(eq(account.id, data.accountId));
      if (!category) {
        throw new Error("Account not found.");
      }
      if (category.bankAccountId !== null) {
        throw new Error("Transfers between bank accounts aren't supported yet.");
      }

      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${journalLine.amount}), 0)`.mapWith(Number) })
        .from(journalLine)
        .where(eq(journalLine.journalEntryId, bankLine.journalId));
      // numeric(14,2) sums come back exact, but round anyway so float noise
      // from mapWith(Number) can't leave the entry a fraction of a cent out.
      const balancingAmount = Math.round(-total * 100) / 100;

      const otherLines = await tx
        .select({ id: journalLine.id, accountId: journalLine.accountId })
        .from(journalLine)
        .where(
          and(
            eq(journalLine.journalEntryId, bankLine.journalId),
            ne(journalLine.id, data.journalLineId),
          ),
        );

      if (otherLines.length === 0) {
        // First save: add the balancing line.
        if (balancingAmount === 0) {
          throw new Error("Transaction has no amount to balance.");
        }
        await tx.insert(journalLine).values({
          journalEntryId: bankLine.journalId,
          accountId: category.id,
          amount: balancingAmount,
          description: bankLine.description ?? bankLine.note,
        });
      } else if (otherLines.length === 1 && balancingAmount === 0) {
        // Already categorised: move the existing balancing line to the new
        // account. Its amount is unchanged, so the entry stays balanced.
        const [otherLine] = otherLines;
        if (otherLine!.accountId !== category.id) {
          await tx
            .update(journalLine)
            .set({ accountId: category.id })
            .where(eq(journalLine.id, otherLine!.id));
        }
      } else {
        // Splits (or an entry left unbalanced some other way) can't be
        // safely reduced to a single account from this screen.
        throw new Error(
          "This transaction is split across several accounts or doesn't balance, so it can't be changed here.",
        );
      }

      if (data.should_post) {
        await tx.update(journal).set({ isPosted: true }).where(eq(journal.id, bankLine.journalId));
      }
    });
  });
