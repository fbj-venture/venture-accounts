// Server-only helpers for postTransaction (transactions-fn.ts). They live in
// their own module, imported only inside the server function's handler, so
// TanStack Start strips them - and the @app/db/direct import - from the
// browser bundle along with the handler. Module-level code next to a
// createServerFn is NOT stripped: helpers kept in transactions-fn.ts pulled
// the database driver into the client and broke hydration app-wide.
import { formatZar } from "#/lib/currency.ts";
import {
  bankAccount,
  db,
  journal,
  journalLine,
  withCreate,
  withUpdate,
} from "@app/db/direct";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

// Banks don't settle at weekends, so the two sides of a Transfer can be
// dated a business day apart. The dates a transfer's other side may carry:
// everything from the weekday (Mon-Fri) before the transaction to the
// weekday after it, both included - so weekend days in between count.
// Computed in UTC on the calendar date, so time zones can't shift the day.
function transferMatchRange(date: Date): { from: string; to: string } {
  const isWeekend = (time: number) => [0, 6].includes(new Date(time).getUTCDay());
  const own = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  let before = own - DAY_MS;
  while (isWeekend(before)) before -= DAY_MS;
  let after = own + DAY_MS;
  while (isWeekend(after)) after += DAY_MS;

  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return { from: iso(before), to: iso(after) };
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BankLine = {
  journalId: number;
  accountId: number;
  amount: number;
  date: Date;
  isPosted: boolean;
  description: string | null;
  note: string;
};

// The entry's lines other than the bank line being saved, flagged with
// whether each is on a bank account (i.e. the entry is already a Transfer).
async function getOtherLines(tx: Tx, journalId: number, journalLineId: number) {
  return tx
    .select({
      id: journalLine.id,
      accountId: journalLine.accountId,
      isBankLine: sql<boolean>`${bankAccount.id} is not null`,
    })
    .from(journalLine)
    .leftJoin(bankAccount, eq(bankAccount.id, journalLine.accountId))
    .where(and(eq(journalLine.journalEntryId, journalId), ne(journalLine.id, journalLineId)));
}

async function getEntryTotal(tx: Tx, journalId: number) {
  const [{ total }] = await tx
    .select({ total: sql<number>`coalesce(sum(${journalLine.amount}), 0)`.mapWith(Number) })
    .from(journalLine)
    .where(eq(journalLine.journalEntryId, journalId));
  // numeric(14,2) sums come back exact, but round anyway so float noise
  // from mapWith(Number) can't leave the entry a fraction of a cent out.
  return Math.round(total * 100) / 100;
}

// The user's own note (already trimmed; "" = none) replaces the lines'
// description. The entry's note keeps the original statement text.
async function setDescription(tx: Tx, lineIds: number[], note: string, userId: string) {
  if (note === "" || lineIds.length === 0) {
    return;
  }
  await tx
    .update(journalLine)
    .set(withUpdate(userId, { description: note }))
    .where(inArray(journalLine.id, lineIds));
}

export async function postToCategory(
  tx: Tx,
  journalLineId: number,
  bankLine: BankLine,
  categoryId: number,
  userId: string,
  note: string,
) {
  const otherLines = await getOtherLines(tx, bankLine.journalId, journalLineId);

  // A matched Transfer's other line is the other bank's own imported line -
  // re-pointing it at a Category would erase that bank's side of the money.
  if (otherLines.some((line) => line.isBankLine)) {
    throw new Error(
      "This transaction is matched as a transfer with another bank account, so it can't be changed to a category here.",
    );
  }

  const balancingAmount = -(await getEntryTotal(tx, bankLine.journalId));

  if (otherLines.length === 0) {
    // First save: add the balancing line.
    if (balancingAmount === 0) {
      throw new Error("Transaction has no amount to balance.");
    }
    await tx.insert(journalLine).values(
      withCreate(userId, {
        journalEntryId: bankLine.journalId,
        accountId: categoryId,
        amount: balancingAmount,
        description: note || (bankLine.description ?? bankLine.note),
      }),
    );
  } else if (otherLines.length === 1 && balancingAmount === 0) {
    // Already categorised: move the existing balancing line to the new
    // account. Its amount is unchanged, so the entry stays balanced.
    const [otherLine] = otherLines;
    if (otherLine!.accountId !== categoryId) {
      await tx
        .update(journalLine)
        .set(withUpdate(userId, { accountId: categoryId }))
        .where(eq(journalLine.id, otherLine!.id));
    }
    await setDescription(tx, [otherLine!.id], note, userId);
  } else {
    // Splits (or an entry left unbalanced some other way) can't be
    // safely reduced to a single account from this screen.
    throw new Error(
      "This transaction is split across several accounts or doesn't balance, so it can't be changed here.",
    );
  }
}

// A Transfer is imported twice - once from each bank's statement - as two
// separate one-line entries. Matching finds the other bank's line (opposite
// amount, dated from the weekday before to the weekday after, not yet
// categorised or posted) and moves it into this entry, so the two bank
// lines balance each other; the other bank's now-empty entry is deleted.
// Exactly one candidate must exist: with several, guessing could pair the
// wrong lines, so that is an error too.
// Its import hash moves with the line, so re-importing either statement
// still skips both sides. No match is an error rather than creating the
// other side here - that would be duplicated when the other bank's
// statement is imported.
export async function postTransfer(
  tx: Tx,
  journalLineId: number,
  bankLine: BankLine,
  target: { id: number; name: string },
  userId: string,
  note: string,
) {
  if (target.id === bankLine.accountId) {
    throw new Error("A transfer must be to a different bank account.");
  }

  const otherLines = await getOtherLines(tx, bankLine.journalId, journalLineId);
  const [existing] = otherLines;

  if (otherLines.length === 1 && existing!.isBankLine) {
    if (existing!.accountId === target.id) {
      // Already matched with this bank - nothing to change; the caller
      // still applies should_post. A note overrides both sides.
      await setDescription(tx, [journalLineId, existing!.id], note, userId);
      return;
    }
    throw new Error(
      "This transaction is already matched as a transfer with a different bank account.",
    );
  }
  if (otherLines.length > 1) {
    throw new Error(
      "This transaction is split across several accounts, so it can't be matched as a transfer.",
    );
  }

  const matchRange = transferMatchRange(bankLine.date);

  // Lock the candidates' entries too, so they can't be matched (or
  // categorised) by someone else at the same moment. Two rows is enough to
  // tell "one match" from "several".
  const counterparts = await tx
    .select({
      lineId: journalLine.id,
      journalId: journal.id,
      description: journalLine.description,
      note: journal.note,
      date: journal.date,
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .where(
      and(
        eq(journalLine.accountId, target.id),
        eq(journalLine.amount, -bankLine.amount),
        eq(journal.isPosted, false),
        ne(journal.id, bankLine.journalId),
        sql`${journal.date} between ${matchRange.from}::date and ${matchRange.to}::date`,
        // Only its own imported bank line - not already categorised or
        // matched with something else.
        sql`(select count(*) from journal_line entry_lines where entry_lines.journal_entry_id = ${journal.id}) = 1`,
      ),
    )
    .orderBy(asc(journalLine.id))
    .limit(2)
    .for("update", { of: journal });

  const expected = `${formatZar(-bankLine.amount)} in ${target.name}`;
  if (counterparts.length > 1) {
    throw new Error(
      `More than one transaction matches ${expected} between ${matchRange.from} and ${matchRange.to}, so it can't be chosen automatically. ` +
        `Match this transfer by hand once the others are sorted out.`,
    );
  }
  const [counterpart] = counterparts;
  if (!counterpart) {
    throw new Error(
      `No matching transaction found: expected ${expected} between ${matchRange.from} and ${matchRange.to}. ` +
        `Check that account's statement has been imported and that the amount and date agree.`,
    );
  }

  // Switching from a Category to a Transfer: the category line goes, the
  // other bank's line takes its place.
  if (existing) {
    await tx.delete(journalLine).where(eq(journalLine.id, existing.id));
  }

  await tx
    .update(journalLine)
    .set(
      withUpdate(userId, {
        journalEntryId: bankLine.journalId,
        // The other bank may date its side differently from this entry; its
        // own date is about to be deleted with its entry - keep it on the
        // line so that bank's reconciliation still finds it on its statement.
        statementDate: counterpart.date,
        // Imported lines carry their text on the entry's note, which is about
        // to be deleted - keep it on the line.
        description: counterpart.description ?? counterpart.note,
      }),
    )
    .where(eq(journalLine.id, counterpart.lineId));
  await tx.delete(journal).where(eq(journal.id, counterpart.journalId));
  await setDescription(tx, [journalLineId, counterpart.lineId], note, userId);

  if ((await getEntryTotal(tx, bankLine.journalId)) !== 0) {
    // Can't happen with the filters above - but never commit an
    // unbalanced entry. Throwing rolls the whole save back.
    throw new Error("Matching this transfer would leave the transaction unbalanced.");
  }
}
