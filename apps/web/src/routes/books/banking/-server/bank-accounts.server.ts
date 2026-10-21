import { account, bank, bankAccount, db } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { eq, sql } from "drizzle-orm"

// Joins the ledger Account with its real-world bankAccount details (see
// docs/Ledger Ubiquitous Language.md - "Account" is overloaded) into one
// flat shape for display.
const bankAccountColumns = {
  id: account.id,
  name: account.name,
  description: account.description,
  bankName: bank.name,
  bankLogo: bank.logo,
  accountNumber: bankAccount.accountNumber,
  // Archived on either half: the Account or its bank details.
  isArchived: sql<boolean>`${account.isArchived} or ${bankAccount.isArchived}`,
}

export type BankAccountDetails = Awaited<ReturnType<typeof getBankAccounts>>[number]

// Every bank account, archived ones included, so a page for an archived one
// can still be opened. Lists and drop-downs use loadActiveBankAccounts.
export const getBankAccounts = createServerFn({ method: "GET" }).handler(async () => {
  return db
    .select(bankAccountColumns)
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .leftJoin(bank, eq(bank.id, bankAccount.bankId))
})
