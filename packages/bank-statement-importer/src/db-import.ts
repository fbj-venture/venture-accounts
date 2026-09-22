import { account, bankAccount, db } from "@app/db";
import { eq } from "drizzle-orm";

// "Account" is overloaded (see docs/Ledger Ubiquitous Language.md): this
// looks up the ledger Account - what a Journal Line actually references -
// via the real-world bank account number extracted from a statement's
// header, joining through bankAccount (the 1:1 real-world details).
export async function findAccountByBankAccountNumber(accountNumber: string) {
  const [row] = await db
    .select({ account, bankAccount })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .where(eq(bankAccount.accountNumber, accountNumber))
    .limit(1);

  return { found: Boolean(row), account: row?.account, bankAccount: row?.bankAccount };
}
