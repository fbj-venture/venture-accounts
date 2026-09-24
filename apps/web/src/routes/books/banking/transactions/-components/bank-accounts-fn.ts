import { account, bankAccount, db } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

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
