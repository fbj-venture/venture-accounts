import { requireUser } from "#/lib/require-user.server.ts";
import { OPENING_BALANCE_EQUITY_ACCOUNT } from "#/routes/books/banking/-components/opening-balance.server.ts";
import { account, accountType, bankAccount, db } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Keep ALL database code inside handlers - see
// transactions/-components/transactions-fn.ts for why.

export const MAX_ACCOUNT_NAME_LENGTH = 100;

// Renames one Account. Every Journal Line points at the account by id, so the
// new name shows on past and future transactions alike - nothing is rewritten.
export const renameAccount = createServerFn({ method: "POST" })
  .validator((data: { id: number; name: string }) => data)
  .handler(async ({ data }) => {
    await requireUser();
    const name = data.name.trim();
    if (name === "") {
      throw new Error("The name can't be empty.");
    }
    if (name.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`);
    }

    const [existing] = await db
      .select({ name: account.name })
      .from(account)
      .where(eq(account.id, data.id));
    if (!existing) {
      throw new Error("Account not found.");
    }
    // Looked up by this name when an opening balance is set, so it can't change.
    if (existing.name === OPENING_BALANCE_EQUITY_ACCOUNT) {
      throw new Error(`"${existing.name}" is used by the app by name, so it can't be renamed.`);
    }
    if (name === existing.name) {
      return;
    }

    // Names are unique; "Salaries" and "salaries" would only be confusing.
    const [clash] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(sql`lower(${account.name}) = lower(${name})`, ne(account.id, data.id)));
    if (clash) {
      throw new Error(`An account called "${name}" already exists.`);
    }

    await db.update(account).set({ name, updatedAt: new Date() }).where(eq(account.id, data.id));
  });

export const MAX_BANK_NAME_LENGTH = 100;
export const MAX_ACCOUNT_NUMBER_LENGTH = 30;

// Changes the real-world details behind a bank Account: the bank's name and
// the account number. Statement imports find the Account by the number printed
// on the statement (digits only, spaces removed - see extractAccountNumber in
// the importer), so a number that isn't digits could never be matched.
export const updateBankAccount = createServerFn({ method: "POST" })
  .validator((data: { id: number; bankName: string; accountNumber: string }) => data)
  .handler(async ({ data }) => {
    await requireUser();
    const bankName = data.bankName.trim();
    const accountNumber = data.accountNumber.replace(/\s+/g, "");
    if (bankName === "") {
      throw new Error("The bank name can't be empty.");
    }
    if (bankName.length > MAX_BANK_NAME_LENGTH) {
      throw new Error(`The bank name can be at most ${MAX_BANK_NAME_LENGTH} characters.`);
    }
    if (!/^\d+$/.test(accountNumber) || accountNumber.length > MAX_ACCOUNT_NUMBER_LENGTH) {
      throw new Error(
        `The account number must be digits only, as printed on the statement (at most ${MAX_ACCOUNT_NUMBER_LENGTH}).`,
      );
    }

    const [existing] = await db
      .select({ id: bankAccount.id })
      .from(bankAccount)
      .where(eq(bankAccount.id, data.id));
    if (!existing) {
      throw new Error("Bank account not found.");
    }

    const [clash] = await db
      .select({ id: bankAccount.id })
      .from(bankAccount)
      .where(and(eq(bankAccount.accountNumber, accountNumber), ne(bankAccount.id, data.id)));
    if (clash) {
      throw new Error(`Another bank account already has the number ${accountNumber}.`);
    }

    await db
      .update(bankAccount)
      .set({ bankName, accountNumber, updatedAt: new Date() })
      .where(eq(bankAccount.id, data.id));
  });

// Every Account Type, in its canonical order (Asset, Liability, Equity,
// Income, Expense) - the choices for the page's type filter. It comes from the
// table rather than the accounts, so a type nothing uses yet is still offered.
export const getAccountTypes = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  return await db
    .select({ id: accountType.id, name: accountType.name })
    .from(accountType)
    .orderBy(asc(accountType.id));
});

// Every ledger Account ("Accounts" in the UI), with its Account Type and - for
// the ones that are real bank accounts - the bank details behind it. A
// sub-account is named "Parent:Child" (fullName), so it reads on one line.
export type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number];

export const getAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const parent = alias(account, "parent");
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      description: account.description,
      parentName: parent.name,
      accountTypeId: accountType.id,
      accountType: accountType.name,
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
    })
    .from(account)
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .leftJoin(parent, eq(parent.id, account.parentId))
    .leftJoin(bankAccount, eq(bankAccount.id, account.id));

  // By Account Type (in the canonical order its fixed ids give: Asset,
  // Liability, Equity, Income, Expense), then alphabetically by the name
  // shown - so a sub-account sorts with its parent's name ("Charitable
  // giving:Missions" among the C's) and not under its own.
  return rows
    .map((row) => ({
      ...row,
      fullName: row.parentName ? `${row.parentName}:${row.name}` : row.name,
    }))
    .sort(
      (a, b) =>
        a.accountTypeId - b.accountTypeId ||
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    );
});
