import { account, accountType, bankAccount, db, journal, journalLine } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// The single Equity account every take-on entry's other line is posted
// against - see docs/Ledger Ubiquitous Language.md ("Opening balance").
const OPENING_BALANCE_EQUITY_ACCOUNT = "Opening Balance Equity";

// Joins the ledger Account with its real-world bankAccount details (see
// docs/Ledger Ubiquitous Language.md - "Account" is overloaded) into one
// flat shape for display.
const bankAccountColumns = {
  id: account.id,
  name: account.name,
  description: account.description,
  bankName: bankAccount.bankName,
  accountNumber: bankAccount.accountNumber,
};

export type BankAccountDetails = Awaited<ReturnType<typeof getBankAccounts>>[number];

export const getBankAccounts = createServerFn({ method: "GET" }).handler(
  async () => {
    return db
      .select(bankAccountColumns)
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id));
  },
);

export const getBankAccountById = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const accountId = Number(id);
    if (!Number.isInteger(accountId)) {
      return null;
    }

    const [row] = await db
      .select(bankAccountColumns)
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id))
      .where(eq(account.id, accountId))
      .limit(1);

    return row ?? null;
  });

// A bank account's take-on entry: the journal line on this account whose
// entry's other line is posted against the Opening Balance Equity account.
// Its amount (signed, as always - see journal-line.ts) is the take-on
// balance; null means no opening balance has been set yet.
export const getOpeningBalance = createServerFn({ method: "GET" })
  .validator((accountId: number) => accountId)
  .handler(async ({ data: accountId }) => {
    const equityLine = alias(journalLine, "equity_line");
    const equityAccount = alias(account, "equity_account");

    const [row] = await db
      .select({ amount: journalLine.amount })
      .from(journalLine)
      .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
      .innerJoin(
        equityLine,
        and(eq(equityLine.journalEntryId, journal.id), ne(equityLine.id, journalLine.id)),
      )
      .innerJoin(equityAccount, eq(equityAccount.id, equityLine.accountId))
      .innerJoin(accountType, eq(accountType.id, equityAccount.account_type))
      .where(
        and(
          eq(journalLine.accountId, accountId),
          eq(accountType.name, "Equity"),
          eq(equityAccount.name, OPENING_BALANCE_EQUITY_ACCOUNT),
        ),
      )
      .limit(1);

    return row?.amount ?? null;
  });

// Creates a bank account's take-on entry: a balanced Journal entry with one
// line on the bank account (the take-on amount) and one on Opening Balance
// Equity (the balancing amount). Posted immediately - unlike an imported
// bank transaction, there's no category left to assign.
export const setOpeningBalance = createServerFn({ method: "POST" })
  .validator(
    (data: { accountId: number; date: Date; note: string; amount: number }) => data,
  )
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      const [equityAccount] = await tx
        .select({ id: account.id })
        .from(account)
        .where(eq(account.name, OPENING_BALANCE_EQUITY_ACCOUNT));
      if (!equityAccount) {
        throw new Error(
          `"${OPENING_BALANCE_EQUITY_ACCOUNT}" account not found - it must be seeded before an opening balance can be set.`,
        );
      }

      // Lock against a concurrent call setting the same account's opening
      // balance twice - same shape as getOpeningBalance above.
      const equityLine = alias(journalLine, "equity_line");
      const [existing] = await tx
        .select({ id: journalLine.id })
        .from(journalLine)
        .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
        .innerJoin(
          equityLine,
          and(eq(equityLine.journalEntryId, journal.id), ne(equityLine.id, journalLine.id)),
        )
        .where(
          and(eq(journalLine.accountId, data.accountId), eq(equityLine.accountId, equityAccount.id)),
        )
        .for("update", { of: journal });
      if (existing) {
        throw new Error("This account already has an opening balance.");
      }

      const [entry] = await tx
        .insert(journal)
        .values({ date: data.date, note: data.note, isPosted: true })
        .returning({ id: journal.id });

      await tx.insert(journalLine).values([
        { journalEntryId: entry!.id, accountId: data.accountId, amount: data.amount },
        { journalEntryId: entry!.id, accountId: equityAccount.id, amount: -data.amount },
      ]);
    });
  });
