import { requireUser } from "#/lib/require-user.server.ts"
import { OPENING_BALANCE_EQUITY_ACCOUNT } from "#/routes/books/banking/-server/internal/opening-balance.server"
import {
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
} from "#/routes/books/accounts/-server/accounts.server.ts"
import { account, accountType, bank, bankAccount, db, withCreate, withUpdate } from "@app/db/direct"
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
      bankName: bank.name,
      bankLogo: bank.logo,
      description: bankAccount.description,
      accountNumber: bankAccount.accountNumber,
      isArchived: bankAccount.isArchived,
    })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .leftJoin(bank, eq(bank.id, bankAccount.bankId))
    .orderBy(asc(account.name))
  return rows
})

// Every bank, for the bank drop-downs.
export const getBanks = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser()
  return db
    .select({ id: bank.id, name: bank.name, logo: bank.logo })
    .from(bank)
    .orderBy(asc(bank.name))
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
        bankName: bank.name,
        bankLogo: bank.logo,
        bankDescription: bankAccount.description,
        accountNumber: bankAccount.accountNumber,
        bankIsArchived: bankAccount.isArchived,
        createdAt: bankAccount.createdAt,
        updatedAt: bankAccount.updatedAt,
      })
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id))
      .innerJoin(accountType, eq(accountType.id, account.account_type))
      .leftJoin(bank, eq(bank.id, bankAccount.bankId))
      .where(eq(bankAccount.id, id))
    return row ?? null
  })

export const MAX_DESCRIPTION_LENGTH = 500

// The Account Type of a new bank account: account_type's fixed id for Asset
// (see packages/db/scripts/seed-account-types.ts).
const ASSET_ACCOUNT_TYPE_ID = 1

// Adds a bank account: the ledger Account (an Asset) and the bank details
// behind it, in one transaction so a failure can't leave only one half. The
// rules are those of updateBankAccountDetails.
export const createBankAccount = createServerFn({ method: "POST" })
  .validator(
    (data: {
      accountName: string
      bankId: number
      bankDescription: string
      accountNumber: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const accountName = data.accountName.trim()
    const bankDescription = data.bankDescription.trim()
    const accountNumber = data.accountNumber.replace(/\s+/g, "")

    if (accountName === "") {
      throw new Error("The account name can't be empty.")
    }
    if (accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The account name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
    }
    if (bankDescription === "") {
      throw new Error("The bank account description can't be empty.")
    }
    if (bankDescription.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`A description can be at most ${MAX_DESCRIPTION_LENGTH} characters.`)
    }
    if (!/^\d+$/.test(accountNumber) || accountNumber.length > MAX_ACCOUNT_NUMBER_LENGTH) {
      throw new Error(
        `The account number must be digits only, as printed on the statement (at most ${MAX_ACCOUNT_NUMBER_LENGTH}).`,
      )
    }

    await db.transaction(async (tx) => {
      const [chosenBank] = await tx
        .select({ id: bank.id })
        .from(bank)
        .where(eq(bank.id, data.bankId))
      if (!chosenBank) {
        throw new Error("Choose a bank.")
      }
      // Names are unique; "Salaries" and "salaries" would only be confusing.
      const [nameClash] = await tx
        .select({ id: account.id })
        .from(account)
        .where(sql`lower(${account.name}) = lower(${accountName})`)
      if (nameClash) {
        throw new Error(`An account called "${accountName}" already exists.`)
      }
      const [numberClash] = await tx
        .select({ id: bankAccount.id })
        .from(bankAccount)
        .where(eq(bankAccount.accountNumber, accountNumber))
      if (numberClash) {
        throw new Error(`Another bank account already has the number ${accountNumber}.`)
      }

      const [created] = await tx
        .insert(account)
        .values(
          withCreate(userId, {
            name: accountName,
            description: bankDescription,
            isArchived: false,
            account_type: ASSET_ACCOUNT_TYPE_ID,
            parentId: null,
          }),
        )
        .returning({ id: account.id })
      await tx.insert(bankAccount).values(
        withCreate(userId, {
          id: created!.id,
          bankId: data.bankId,
          description: bankDescription,
          accountNumber,
          isArchived: false,
        }),
      )
    })
  })

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
      bankDescription: string
      accountNumber: string
      bankIsArchived: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const accountName = data.accountName.trim()
    const accountDescription = data.accountDescription.trim()
    const bankDescription = data.bankDescription.trim()
    const accountNumber = data.accountNumber.replace(/\s+/g, "")

    if (accountName === "") {
      throw new Error("The account name can't be empty.")
    }
    if (accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The account name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
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
            description: bankDescription,
            accountNumber,
            isArchived: data.bankIsArchived,
          }),
        )
        .where(eq(bankAccount.id, data.id))
    })
  })
