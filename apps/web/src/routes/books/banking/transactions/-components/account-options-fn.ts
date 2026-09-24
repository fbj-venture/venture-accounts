import type { AccountOptions } from "#/components/account-selector.tsx";
import { account, accountType, bankAccount, db } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Everything a transaction can be posted against, split the way the
// AccountSelector shows it: accounts with bankAccount details are Banks,
// every other Account is a Category.
export const getAccountOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountOptions> => {
    const parent = alias(account, "parent");
    const rows = await db
      .select({
        id: account.id,
        name: account.name,
        parentName: parent.name,
        bankAccountId: bankAccount.id,
        accountNumber: bankAccount.accountNumber,
        accountTypeId: accountType.id,
        accountType: accountType.name,
      })
      .from(account)
      .innerJoin(accountType, eq(accountType.id, account.account_type))
      .leftJoin(parent, eq(parent.id, account.parentId))
      .leftJoin(bankAccount, eq(bankAccount.id, account.id))
      .orderBy(asc(account.name));

    // Order by Account Type, reversing the canonical order its fixed ids
    // give - so the selector groups Expense, Income, Equity, Liability,
    // Asset - then sub-accounts directly under their parent.
    const byPath = (row: (typeof rows)[number]) =>
      row.parentName ? `${row.parentName}\u0000${row.name}` : row.name;
    rows.sort(
      (a, b) => b.accountTypeId - a.accountTypeId || byPath(a).localeCompare(byPath(b)),
    );

    const toOption = ({ id, name, parentName, accountNumber, accountType }: (typeof rows)[number]) => ({
      id,
      name,
      parentName,
      accountNumber,
      accountType,
    });
    return {
      categories: rows.filter((row) => row.bankAccountId === null).map(toOption),
      banks: rows.filter((row) => row.bankAccountId !== null).map(toOption),
    };
  },
);
