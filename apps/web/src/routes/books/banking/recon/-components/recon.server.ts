// Reconciliation server code: the createServerFn handlers the UI calls, plus
// the helpers they share.
import { requireUser } from "#/lib/require-user.server.ts";
import {
  account,
  accountType,
  bankAccount,
  bankUpload,
  db,
  journal,
  journalLine,
  recon,
  withCreate,
  withUpdate,
} from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { findOpeningBalanceEntry } from "../../-server/opening-balance.server.ts";

// Where a reconciliation's opening balance comes from:
//  - after a balanced reconciliation: its closing balance (locked) - the
//    next statement starts where the last one ended;
//  - the first one, with a take-on entry: the take-on amount (locked);
//  - the first one, with neither: nothing yet, so the user types it.
// previousStatementDate ("yyyy-MM-dd") is the day that opening balance is as
// at: the last balanced statement's end date, or the take-on date; null when
// there is neither.
export async function resolveReconSetup(bankAccountId: number) {
  const [openRecon] = await db
    .select()
    .from(recon)
    .where(and(eq(recon.bankAccountId, bankAccountId), isNull(recon.ballancedAt)))
    .orderBy(desc(recon.id))
    .limit(1);

  const [lastBalanced] = await db
    .select({ closingBallance: recon.closingBallance, statementDate: recon.statementDate })
    .from(recon)
    .where(and(eq(recon.bankAccountId, bankAccountId), isNotNull(recon.ballancedAt)))
    .orderBy(desc(recon.ballancedAt), desc(recon.id))
    .limit(1);

  if (lastBalanced) {
    return {
      openRecon,
      openingBalance: lastBalanced.closingBallance,
      openingBalanceLocked: true,
      previousStatementDate: lastBalanced.statementDate,
    };
  }

  const takeOn = await findOpeningBalanceEntry(bankAccountId);
  if (takeOn !== null) {
    return {
      openRecon,
      openingBalance: takeOn.amount,
      openingBalanceLocked: true,
      previousStatementDate: takeOn.date,
    };
  }

  return {
    openRecon,
    openingBalance: openRecon?.openingBallance ?? null,
    openingBalanceLocked: false,
    previousStatementDate: null,
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

// The date a bank line has on its own bank's statement: the line's own date
// when it has one (the other side of a matched Transfer, which that bank may
// date differently from the entry), otherwise the entry's date.
const lineDate = sql`coalesce(${journalLine.statementDate}, ${journal.date})`;

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
    sql`${lineDate} <= ${row.statementDate}::date`,
  );

  const lines = await tx
    .select({
      journalLineId: journalLine.id,
      date: sql<string>`to_char(${lineDate}, 'YYYY-MM-DD')`,
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
    .orderBy(asc(lineDate), asc(journalLine.id));

  return lines.map(({ journalLineId, date, note, description, amount, included }) => ({
    journalLineId,
    date: toDate(date),
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
  userId: string,
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
      .set(withUpdate(userId, { isReconciled: true, bankReconId: row.id }))
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
      .set(withUpdate(userId, { isReconciled: false, bankReconId: null }))
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


// Keep ALL database code inside handlers or the helpers they call - see
// transactions/-server/transactions-fn.ts for why.

export type ReconForm = Awaited<ReturnType<typeof getReconForm>>;

// What the reconciliation form starts with for a bank account: the open
// (not yet balanced) reconciliation if there is one, otherwise a fresh one.
export const getReconForm = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    const { openRecon, openingBalance, openingBalanceLocked, previousStatementDate } =
      await resolveReconSetup(bankAccountId);
    // The statement the open reconciliation is linked to, if any.
    let upload: UploadSummary | null = null;
    if (openRecon?.bankUploadId) {
      const [row] = await db
        .select({
          id: bankUpload.id,
          description: bankUpload.description,
          uploadedAt: bankUpload.createdAt,
        })
        .from(bankUpload)
        .where(eq(bankUpload.id, openRecon.bankUploadId));
      upload = row ?? null;
    }
    return {
      reconId: openRecon?.id ?? null,
      openingBalance,
      openingBalanceLocked,
      previousStatementDate,
      closingBalance: openRecon?.closingBallance ?? null,
      // yyyy-MM-dd, as stored.
      statementDate: openRecon?.statementDate ?? null,
      upload,
    };
  });

export type UploadSummary = { id: number; description: string; uploadedAt: Date; };

// The bank account's uploads that no reconciliation is linked to yet,
// newest first.
export const listUnlinkedUploads = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    await requireUser();
    return db
      .select({
        id: bankUpload.id,
        description: bankUpload.description,
        path: bankUpload.fileUrl,
        uploadedAt: bankUpload.createdAt,
      })
      .from(bankUpload)
      .where(
        and(
          eq(bankUpload.bankId, bankAccountId),
          notExists(db.select({ one: recon.id }).from(recon).where(eq(recon.bankUploadId, bankUpload.id))),
        ),
      )
      .orderBy(desc(bankUpload.createdAt), desc(bankUpload.id));
  });

export type ReconHistoryItem = Awaited<ReturnType<typeof listReconHistory>>[number];

// A bank account's balanced reconciliations, most recent first.
export const listReconHistory = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    const rows = await db
      .select({
        id: recon.id,
        statementDate: recon.statementDate,
        openingBalance: recon.openingBallance,
        closingBalance: recon.closingBallance,
        ballancedAt: recon.ballancedAt,
        uploadId: bankUpload.id,
        uploadDescription: bankUpload.description,
      })
      .from(recon)
      .leftJoin(bankUpload, eq(bankUpload.id, recon.bankUploadId))
      .where(and(eq(recon.bankAccountId, bankAccountId), isNotNull(recon.ballancedAt)))
      .orderBy(desc(recon.statementDate), desc(recon.id));
    return rows.map(({ ballancedAt, ...row }) => ({
      ...row,
      balancedAt: ballancedAt!.toISOString(),
    }));
  });

// Links a reconciliation to an uploaded statement, or - with null - unlinks it.
export const setReconUpload = createServerFn({ method: "POST" })
  .validator((data: { reconId: number; bankUploadId: number | null; }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser();
    const [row] = await db
      .select({ bankAccountId: recon.bankAccountId })
      .from(recon)
      .where(eq(recon.id, data.reconId));
    if (!row) {
      throw new Error("Reconciliation not found.");
    }
    if (data.bankUploadId !== null) {
      const [upload] = await db
        .select({ id: bankUpload.id })
        .from(bankUpload)
        .where(
          and(
            eq(bankUpload.id, data.bankUploadId),
            eq(bankUpload.bankId, row.bankAccountId),
            notExists(
              db
                .select({ one: recon.id })
                .from(recon)
                .where(and(eq(recon.bankUploadId, bankUpload.id), ne(recon.id, data.reconId))),
            ),
          ),
        );
      if (!upload) {
        throw new Error("That upload can't be linked - it may already be linked to another reconciliation.");
      }
    }
    await db
      .update(recon)
      .set(withUpdate(userId, { bankUploadId: data.bankUploadId }))
      .where(eq(recon.id, data.reconId));
  });

type SaveReconInput = {
  bankAccountId: number;
  /** Ignored when the opening balance is locked - the server decides it. */
  openingBalance: number | null;
  closingBalance: number;
  /** yyyy-MM-dd */
  statementDate: string;
  /** The uploaded statement this reconciliation is linked to, if any. */
  bankUploadId: number | null;
};

export const saveRecon = createServerFn({ method: "POST" })
  .validator((data: SaveReconInput) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.statementDate)) {
      throw new Error("Statement date is not a valid date.");
    }
    if (!Number.isFinite(data.closingBalance)) {
      throw new Error("Closing balance is not a number.");
    }

    // Never trust the client for a locked opening balance.
    const { openRecon, openingBalance, openingBalanceLocked } = await resolveReconSetup(
      data.bankAccountId,
    );
    const opening = openingBalanceLocked ? openingBalance : data.openingBalance;
    if (opening === null || !Number.isFinite(opening)) {
      throw new Error("Opening balance is required.");
    }

    if (data.bankUploadId !== null) {
      // Must be this account's upload, and not linked to another reconciliation.
      const [upload] = await db
        .select({ id: bankUpload.id })
        .from(bankUpload)
        .where(
          and(
            eq(bankUpload.id, data.bankUploadId),
            eq(bankUpload.bankId, data.bankAccountId),
            notExists(
              db
                .select({ one: recon.id })
                .from(recon)
                .where(
                  and(
                    eq(recon.bankUploadId, bankUpload.id),
                    openRecon ? ne(recon.id, openRecon.id) : undefined,
                  ),
                ),
            ),
          ),
        );
      if (!upload) {
        throw new Error("That upload can't be linked - it may already be linked to another reconciliation.");
      }
    }

    const values = {
      openingBallance: opening,
      closingBallance: data.closingBalance,
      statementDate: data.statementDate,
      bankUploadId: data.bankUploadId,
    };
    if (openRecon) {
      await db.update(recon).set(withUpdate(userId, values)).where(eq(recon.id, openRecon.id));
      return { reconId: openRecon.id };
    }
    const [created] = await db
      .insert(recon)
      .values(withCreate(userId, { bankAccountId: data.bankAccountId, ...values }))
      .returning({ id: recon.id });
    return { reconId: created!.id };
  });

export type ReconDetails = NonNullable<Awaited<ReturnType<typeof getReconDetails>>>;

// Everything the reconciliation page shows for one reconciliation: its bank
// account, the statement figures and the lines it lists - see listReconLines.
export const getReconDetails = createServerFn({ method: "GET" })
  .validator((reconId: number) => reconId)
  .handler(async ({ data: reconId }) => {
    const [row] = await db
      .select({
        id: recon.id,
        bankAccountId: recon.bankAccountId,
        openingBalance: recon.openingBallance,
        closingBalance: recon.closingBallance,
        statementDate: recon.statementDate,
        ballancedAt: recon.ballancedAt,
        name: account.name,
        description: account.description,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
      })
      .from(recon)
      .innerJoin(bankAccount, eq(bankAccount.id, recon.bankAccountId))
      .innerJoin(account, eq(account.id, bankAccount.id))
      .where(eq(recon.id, reconId));
    if (!row) {
      return null;
    }

    const transactions = await listReconLines(db, {
      id: row.id,
      bankAccountId: row.bankAccountId,
      statementDate: row.statementDate,
      isBalanced: row.ballancedAt !== null,
    });

    return {
      recon: {
        id: row.id,
        openingBalance: row.openingBalance,
        closingBalance: row.closingBalance,
        statementDate: row.statementDate,
        isBalanced: row.ballancedAt !== null,
      },
      bankAccount: {
        id: row.bankAccountId,
        name: row.name,
        description: row.description,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
      },
      transactions,
    };
  });

type ReconSelection = { reconId: number; includedLineIds: number[]; };

async function loadOpenRecon(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], reconId: number) {
  const [row] = await tx
    .select({
      id: recon.id,
      bankAccountId: recon.bankAccountId,
      statementDate: recon.statementDate,
      openingBalance: recon.openingBallance,
      closingBalance: recon.closingBallance,
      ballancedAt: recon.ballancedAt,
    })
    .from(recon)
    .where(eq(recon.id, reconId))
    .for("update");
  if (!row) {
    throw new Error("Reconciliation not found.");
  }
  if (row.ballancedAt) {
    throw new Error("This reconciliation is already balanced.");
  }
  return { ...row, isBalanced: false };
}

// Saves which transactions are ticked off: they become reconciled and are
// linked to this reconciliation; lines it held before that are no longer
// ticked are released. Nothing else about the reconciliation changes.
export const saveReconLines = createServerFn({ method: "POST" })
  .validator((data: ReconSelection) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser();
    await db.transaction(async (tx) => {
      const row = await loadOpenRecon(tx, data.reconId);
      await applyReconSelection(tx, row, data.includedLineIds, userId);
    });
  });

// Saves the ticks as above, then - only if the opening balance plus the
// ticked lines equals the closing balance, checked here rather than trusted
// from the browser - marks the reconciliation balanced.
export const markReconBalanced = createServerFn({ method: "POST" })
  .validator((data: ReconSelection) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser();
    await db.transaction(async (tx) => {
      const row = await loadOpenRecon(tx, data.reconId);
      const linesCents = await applyReconSelection(tx, row, data.includedLineIds, userId);
      const totalCents = Math.round(row.openingBalance * 100) + linesCents;
      if (totalCents !== Math.round(row.closingBalance * 100)) {
        throw new Error(
          `The running total (${totalCents / 100}) doesn't equal the closing balance (${row.closingBalance}) - nothing was saved.`,
        );
      }
      await tx
        .update(recon)
        .set(withUpdate(userId, { ballancedAt: new Date() }))
        .where(eq(recon.id, row.id));
    });
  });
