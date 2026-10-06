import { requireUser } from "#/lib/require-user.server.ts";
import { account, bankAccount, db, recon, withCreate, withUpdate } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { applyReconSelection, listReconLines, resolveReconSetup } from "./recon.server.ts";

// Keep ALL database code inside handlers (or in recon.server.ts, used only
// from a handler) - see transactions/-components/transactions-fn.ts for why.

export type ReconForm = Awaited<ReturnType<typeof getReconForm>>;

// What the reconciliation form starts with for a bank account: the open
// (not yet balanced) reconciliation if there is one, otherwise a fresh one.
export const getReconForm = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    const { openRecon, openingBalance, openingBalanceLocked } =
      await resolveReconSetup(bankAccountId);
    return {
      reconId: openRecon?.id ?? null,
      openingBalance,
      openingBalanceLocked,
      closingBalance: openRecon?.closingBallance ?? null,
      // yyyy-MM-dd, as stored.
      statementDate: openRecon?.statementDate ?? null,
    };
  });

type SaveReconInput = {
  bankAccountId: number;
  /** Ignored when the opening balance is locked - the server decides it. */
  openingBalance: number | null;
  closingBalance: number;
  /** yyyy-MM-dd */
  statementDate: string;
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

    const values = {
      openingBallance: opening,
      closingBallance: data.closingBalance,
      statementDate: data.statementDate,
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

type ReconSelection = { reconId: number; includedLineIds: number[] };

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
