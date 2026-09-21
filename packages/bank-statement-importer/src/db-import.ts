import { bankAccounts, db } from "@app/db";
import { eq } from "drizzle-orm";

export async function findBankAccountByNumber(accountNumber: string) {
  return db.query.bankAccounts.findFirst({
    where: eq(bankAccounts.accountNumber, accountNumber),
  });
}
