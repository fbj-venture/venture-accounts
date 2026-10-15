import { requireUser } from "#/lib/require-user.server.ts"
import { OPENING_BALANCE_EQUITY_ACCOUNT } from "#/routes/books/banking/-server/internal/opening-balance.server"
import {
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
  MAX_BANK_NAME_LENGTH,
} from "#/routes/books/accounts/-server/accounts.server.ts"
import { account, accountType, bankAccount, db, withUpdate } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, ne, sql } from "drizzle-orm"

// Keep ALL database code inside handlers - see the route folder layout in
// CLAUDE.md for why.

// Every bank account with the bank details behind it, archived ones included
// (the page filters them). fullName is the Account's name, which is what the
// bank details dialog shows.
export type BankAccountRow = Awaited<ReturnType<typeof getBankAccounts>>[number]

export const getBankAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser()
  const rows = await db
    .select({
      id: bankAccount.id,
      fullName: account.name,
      bankName: bankAccount.bankName,
      description: bankAccount.description,
      accountNumber: bankAccount.accountNumber,
      isArchived: bankAccount.isArchived,
    })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .orderBy(asc(account.name))
  return rows
})

// One bank account with both halves of what describes it: the ledger Account
// (name, description, archived) and the bank details behind it. Null when
// there is no such bank account.
export type BankAccountDetails = NonNullable<Awaited<ReturnType<typeof getBankAccount>>>

export const getBankAccount = createServerFn({ method: "GET" })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await requireUser()
    const [row] = await db
      .select({
        id: bankAccount.id,
        accountType: accountType.name,
        accountName: account.name,
        accountDescription: account.description,
        accountIsArchived: account.isArchived,
        bankName: bankAccount.bankName,
        bankDescription: bankAccount.description,
        accountNumber: bankAccount.accountNumber,
        bankIsArchived: bankAccount.isArchived,
        createdAt: bankAccount.createdAt,
        updatedAt: bankAccount.updatedAt,
      })
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id))
      .innerJoin(accountType, eq(accountType.id, account.account_type))
      .where(eq(bankAccount.id, id))
    return row ?? null
  })

export const MAX_DESCRIPTION_LENGTH = 500

// Saves the Account and its bank details together, in one transaction so a
// failure can't leave one half changed. The rules are those of renaming an
// Account and of changing bank details elsewhere (see accounts.server.ts).
export const updateBankAccountDetails = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: number
      accountName: string
      accountDescription: string
      accountIsArchived: boolean
      bankName: string
      bankDescription: string
      accountNumber: string
      bankIsArchived: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const accountName = data.accountName.trim()
    const accountDescription = data.accountDescription.trim()
    const bankName = data.bankName.trim()
    const bankDescription = data.bankDescription.trim()
    const accountNumber = data.accountNumber.replace(/\s+/g, "")

    if (accountName === "") {
      throw new Error("The account name can't be empty.")
    }
    if (accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The account name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
    }
    if (bankName === "") {
      throw new Error("The bank name can't be empty.")
    }
    if (bankName.length > MAX_BANK_NAME_LENGTH) {
      throw new Error(`The bank name can be at most ${MAX_BANK_NAME_LENGTH} characters.`)
    }
    if (bankDescription === "") {
      throw new Error("The bank account description can't be empty.")
    }
    if (
      accountDescription.length > MAX_DESCRIPTION_LENGTH ||
      bankDescription.length > MAX_DESCRIPTION_LENGTH
    ) {
      throw new Error(`A description can be at most ${MAX_DESCRIPTION_LENGTH} characters.`)
    }
    if (!/^\d+$/.test(accountNumber) || accountNumber.length > MAX_ACCOUNT_NUMBER_LENGTH) {
      throw new Error(
        `The account number must be digits only, as printed on the statement (at most ${MAX_ACCOUNT_NUMBER_LENGTH}).`,
      )
    }

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ name: account.name })
        .from(account)
        .innerJoin(bankAccount, eq(bankAccount.id, account.id))
        .where(eq(account.id, data.id))
      if (!existing) {
        throw new Error("Bank account not found.")
      }

      if (accountName !== existing.name) {
        // Looked up by this name when an opening balance is set, so it can't change.
        if (existing.name === OPENING_BALANCE_EQUITY_ACCOUNT) {
          throw new Error(`"${existing.name}" is used by the app by name, so it can't be renamed.`)
        }
        // Names are unique; "Salaries" and "salaries" would only be confusing.
        const [nameClash] = await tx
          .select({ id: account.id })
          .from(account)
          .where(and(sql`lower(${account.name}) = lower(${accountName})`, ne(account.id, data.id)))
        if (nameClash) {
          throw new Error(`An account called "${accountName}" already exists.`)
        }
      }

      const [numberClash] = await tx
        .select({ id: bankAccount.id })
        .from(bankAccount)
        .where(and(eq(bankAccount.accountNumber, accountNumber), ne(bankAccount.id, data.id)))
      if (numberClash) {
        throw new Error(`Another bank account already has the number ${accountNumber}.`)
      }

      await tx
        .update(account)
        .set(
          withUpdate(userId, {
            name: accountName,
            description: accountDescription === "" ? null : accountDescription,
            isArchived: data.accountIsArchived,
          }),
        )
        .where(eq(account.id, data.id))
      await tx
        .update(bankAccount)
        .set(
          withUpdate(userId, {
            bankName,
            description: bankDescription,
            accountNumber,
            isArchived: data.bankIsArchived,
          }),
        )
        .where(eq(bankAccount.id, data.id))
    })
  })
