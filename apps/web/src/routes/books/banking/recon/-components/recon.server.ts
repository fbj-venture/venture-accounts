// Server-only helper for recon-fn.ts, kept in its own module and imported
// only inside handlers so it - and the database driver - stay out of the
// browser bundle (see transactions/-components/posting.server.ts).
import {
  account,
  accountType,
  bankAccount,
  db,
  journal,
  journalLine,
  recon,
} from "@app/db/direct";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { findOpeningBalance } from "../../-components/opening-balance.server.ts";

// Where a reconciliation's opening balance comes from:
//  - after a balanced reconciliation: its closing balance (locked) - the
//    next statement starts where the last one ended;
//  - the first one, with a take-on entry: the take-on amount (locked);
//  - the first one, with neither: nothing yet, so the user types it.
export async function resolveReconSetup(bankAccountId: number) {
  const [openRecon] = await db
    .select()
    .from(recon)
    .where(and(eq(recon.bankAccountId, bankAccountId), isNull(recon.ballancedAt)))
    .orderBy(desc(recon.id))
    .limit(1);

  const [lastBalanced] = await db
    .select({ closingBallance: recon.closingBallance })
    .from(recon)
    .where(and(eq(recon.bankAccountId, bankAccountId), isNotNull(recon.ballancedAt)))
    .orderBy(desc(recon.ballancedAt), desc(recon.id))
    .limit(1);

  if (lastBalanced) {
    return { openRecon, openingBalance: lastBalanced.closingBallance, openingBalanceLocked: true };
  }

  const takeOn = await findOpeningBalance(bankAccountId);
  if (takeOn !== null) {
    return { openRecon, openingBalance: takeOn, openingBalanceLocked: true };
  }

  return {
    openRecon,
    openingBalance: openRecon?.openingBallance ?? null,
    openingBalanceLocked: false,
  };
}

// ---- The lines a reconciliation lists, and ticking them off ----

// A transaction or the plain connection - both can run these queries.
export type Tx = Pick<typeof db, "select" | "update">;

export type ReconRow = {
  id: number;
  bankAccountId: number;
  statementDate: string;
  isBalanced: boolean;
};

// "yyyy-MM-dd" -> the Date a date column (mode: "date") compares against, on
// the calendar date in UTC so time zones can't shift the day.
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);

// The lines a reconciliation shows: the bank account's posted lines that
// were categorised to an Income or Expense account, or matched as a Transfer
// with another bank account (each bank's statement shows its own side, so
// both accounts list it) - but not the take-on entry, which is the opening
// balance itself - and either were already ticked off by this very reconciliation or -
// while it's still open - are unreconciled and dated up to the statement's
// end date.
export async function listReconLines(tx: Tx, row: ReconRow) {
  const otherLine = alias(journalLine, "other_line");
  const otherAccount = alias(account, "other_account");
  const otherType = alias(accountType, "other_type");
  const isReconcilable = exists(
    tx
      .select({ one: otherLine.id })
      .from(otherLine)
      .innerJoin(otherAccount, eq(otherAccount.id, otherLine.accountId))
      .innerJoin(otherType, eq(otherType.id, otherAccount.account_type))
      .leftJoin(bankAccount, eq(bankAccount.id, otherAccount.id))
      .where(
        and(
          eq(otherLine.journalEntryId, journal.id),
          ne(otherLine.id, journalLine.id),
          or(inArray(otherType.name, ["Income", "Expense"]), isNotNull(bankAccount.id)),
        ),
      ),
  );

  const stillUnreconciled = and(
    isNull(journalLine.bankReconId),
    eq(journalLine.isReconciled, false),
    lte(journal.date, toDate(row.statementDate)),
  );

  const lines = await tx
    .select({
      journalLineId: journalLine.id,
      date: journal.date,
      note: journal.note,
      description: journalLine.description,
      amount: journalLine.amount,
      included: sql<boolean>`coalesce(${journalLine.bankReconId} = ${row.id}, false)`,
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .where(
      and(
        eq(journalLine.accountId, row.bankAccountId),
        eq(journal.isPosted, true),
        isReconcilable,
        row.isBalanced
          ? eq(journalLine.bankReconId, row.id)
          : or(eq(journalLine.bankReconId, row.id), stillUnreconciled),
      ),
    )
    .orderBy(asc(journal.date), asc(journalLine.id));

  return lines.map(({ journalLineId, date, note, description, amount, included }) => ({
    journalLineId,
    date,
    description: description ?? note,
    amount,
    included,
  }));
}

// Makes the reconciliation's ticked lines exactly `includedLineIds`: ticks
// those off (reconciled, linked to it) and releases any it held before that
// aren't in the list. Returns the total of the lines it now holds, in cents.
// Run inside a transaction.
export async function applyReconSelection(
  tx: Tx,
  row: ReconRow,
  includedLineIds: readonly number[],
): Promise<number> {
  const eligible = await listReconLines(tx, row);
  const eligibleIds = new Set(eligible.map((line) => line.journalLineId));
  if (includedLineIds.some((id) => !eligibleIds.has(id))) {
    throw new Error(
      "Some of the ticked transactions can't be reconciled here any more - reload the page.",
    );
  }

  const wanted = new Set(includedLineIds);
  const toTick = eligible.filter((line) => wanted.has(line.journalLineId) && !line.included);
  const toRelease = eligible.filter((line) => !wanted.has(line.journalLineId) && line.included);

  if (toTick.length > 0) {
    await tx
      .update(journalLine)
      .set({ isReconciled: true, bankReconId: row.id })
      .where(
        inArray(
          journalLine.id,
          toTick.map((line) => line.journalLineId),
        ),
      );
  }
  if (toRelease.length > 0) {
    await tx
      .update(journalLine)
      .set({ isReconciled: false, bankReconId: null })
      .where(
        inArray(
          journalLine.id,
          toRelease.map((line) => line.journalLineId),
        ),
      );
  }

  return eligible
    .filter((line) => wanted.has(line.journalLineId))
    .reduce((cents, line) => cents + Math.round(line.amount * 100), 0);
}
