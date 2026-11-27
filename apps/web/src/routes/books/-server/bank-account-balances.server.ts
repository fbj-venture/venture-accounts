import { getOrCreateSettings } from "#/lib/app-settings.server.ts"
import { sortByBankAccountOrder } from "#/lib/bank-account-order.server.ts"
import { requireUser } from "#/lib/require-user.server.ts"
import { account, bank, bankAccount, db, journalLine, settings } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { and, eq, sql } from "drizzle-orm"

export type BankAccountBalance = Awaited<ReturnType<typeof getBankAccountBalances>>[number]

// Balance = SUM(journalLine.amount) for the account (see docs/Ledger
// Ubiquitous Language.md - "Balance"). A bank account is an Asset, whose
// normal balance is debit (positive amount), so no sign flip is needed here
// the way a Liability/Equity/Income account would need.
//
// Sorted by the signed-in user's own order (settings.bankAccountOrder); accounts
// they haven't placed yet come after, by name.
export const getBankAccountBalances = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser()

  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      description: bankAccount.description,
      bankLogo: bank.logo,
      balance: sql<string>`coalesce(sum(${journalLine.amount}), 0)`.mapWith(Number),
    })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .leftJoin(bank, eq(bank.id, bankAccount.bankId))
    .leftJoin(journalLine, eq(journalLine.accountId, account.id))
    .where(and(eq(account.isArchived, false), eq(bankAccount.isArchived, false)))
    .groupBy(account.id, account.name, bankAccount.description, bank.logo)
    .orderBy(account.name)

  return sortByBankAccountOrder(user.id, rows, (row) => row.id)
})

// Saves the signed-in user's order of the dashboard's bank accounts.
export const saveBankAccountOrder = createServerFn({ method: "POST" })
  .validator((data: { ids: number[] }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    await getOrCreateSettings(user.id)
    await db
      .update(settings)
      .set({ bankAccountOrder: [...new Set(data.ids)] })
      .where(eq(settings.userId, user.id))
  })
