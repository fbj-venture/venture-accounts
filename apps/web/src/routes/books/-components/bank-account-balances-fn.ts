import { account, bankAccount, db, journalLine } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";

export type BankAccountBalance = Awaited<
  ReturnType<typeof getBankAccountBalances>
>[number];

// Balance = SUM(journalLine.amount) for the account (see docs/Ledger
// Ubiquitous Language.md - "Balance"). A bank account is an Asset, whose
// normal balance is debit (positive amount), so no sign flip is needed here
// the way a Liability/Equity/Income account would need.
export const getBankAccountBalances = createServerFn({ method: "GET" }).handler(
  async () => {
    return db
      .select({
        id: account.id,
        name: account.name,
        balance: sql<string>`coalesce(sum(${journalLine.amount}), 0)`.mapWith(Number),
      })
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id))
      .leftJoin(journalLine, eq(journalLine.accountId, account.id))
      .groupBy(account.id, account.name)
      .orderBy(account.name);
  },
);
