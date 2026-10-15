import { requireUser } from "#/lib/require-user.server.ts"
import { OPENING_BALANCE_EQUITY_ACCOUNT } from "#/routes/books/banking/-server/internal/opening-balance.server"
import { account, accountType, bankAccount, db, withCreate, withUpdate } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, ne, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

// Keep ALL database code inside handlers - see
// transactions/-components/transactions-fn.ts for why.

export const MAX_ACCOUNT_NAME_LENGTH = 100

// Renames one Account and/or archives it. Every Journal Line points at the account by id, so the
// new name shows on past and future transactions alike - nothing is rewritten.
export const renameAccount = createServerFn({ method: "POST" })
  .validator((data: { id: number; name: string; isArchived: boolean }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const name = data.name.trim()
    if (name === "") {
      throw new Error("The name can't be empty.")
    }
    if (name.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
    }

    const [existing] = await db
      .select({ name: account.name, isArchived: account.isArchived })
      .from(account)
      .where(eq(account.id, data.id))
    if (!existing) {
      throw new Error("Account not found.")
    }
    const renaming = name !== existing.name
    // Looked up by this name when an opening balance is set, so it can't change.
    if (renaming && existing.name === OPENING_BALANCE_EQUITY_ACCOUNT) {
      throw new Error(`"${existing.name}" is used by the app by name, so it can't be renamed.`)
    }
    if (!renaming && data.isArchived === existing.isArchived) {
      return
    }

    // Names are unique; "Salaries" and "salaries" would only be confusing.
    if (renaming) {
      const [clash] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(sql`lower(${account.name}) = lower(${name})`, ne(account.id, data.id)))
      if (clash) {
        throw new Error(`An account called "${name}" already exists.`)
      }
    }

    await db
      .update(account)
      .set(withUpdate(userId, { name, isArchived: data.isArchived }))
      .where(eq(account.id, data.id))
  })

// Adds a new Account. A sub-account takes its parent's Account Type, so
// accountTypeId is only used when there is no parent. Only an Account that is not
// itself a sub-account can be a parent (a sub-account is shown as "Parent:Child").
export const createAccount = createServerFn({ method: "POST" })
  .validator(
    (data: { name: string; isArchived: boolean; accountTypeId: number; parentId: number | null }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const name = data.name.trim()
    if (name === "") {
      throw new Error("The name can't be empty.")
    }
    if (name.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new Error(`The name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
    }

    let accountTypeId = data.accountTypeId
    if (data.parentId !== null) {
      const [parent] = await db
        .select({ accountType: account.account_type, parentId: account.parentId })
        .from(account)
        .where(eq(account.id, data.parentId))
      if (!parent) {
        throw new Error("The parent account was not found.")
      }
      if (parent.parentId !== null) {
        throw new Error("A sub-account can't have sub-accounts of its own.")
      }
      accountTypeId = parent.accountType
    } else {
      const [type] = await db
        .select({ id: accountType.id })
        .from(accountType)
        .where(eq(accountType.id, accountTypeId))
      if (!type) {
        throw new Error("Choose an account type.")
      }
    }

    // Names are unique; "Salaries" and "salaries" would only be confusing.
    const [clash] = await db
      .select({ id: account.id })
      .from(account)
      .where(sql`lower(${account.name}) = lower(${name})`)
    if (clash) {
      throw new Error(`An account called "${name}" already exists.`)
    }

    await db.insert(account).values(
      withCreate(userId, {
        name,
        isArchived: data.isArchived,
        account_type: accountTypeId,
        parentId: data.parentId,
      }),
    )
  })

export const MAX_BANK_NAME_LENGTH = 100
export const MAX_ACCOUNT_NUMBER_LENGTH = 30

// Every Account Type, in its canonical order (Asset, Liability, Equity,
// Income, Expense) - the choices for the page's type filter. It comes from the
// table rather than the accounts, so a type nothing uses yet is still offered.
export const getAccountTypes = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser()
  return await db
    .select({ id: accountType.id, name: accountType.name })
    .from(accountType)
    .orderBy(asc(accountType.id))
})

// Every ledger Account ("Accounts" in the UI), with its Account Type and - for
// the ones that are real bank accounts - the bank details behind it. A
// sub-account is named "Parent:Child" (fullName), so it reads on one line.
export type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number]

export const getAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser()
  const parent = alias(account, "parent")
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      description: account.description,
      isArchived: account.isArchived,
      parentId: account.parentId,
      parentName: parent.name,
      accountTypeId: accountType.id,
      accountType: accountType.name,
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      bankIsArchived: bankAccount.isArchived,
    })
    .from(account)
    .innerJoin(accountType, eq(accountType.id, account.account_type))
    .leftJoin(parent, eq(parent.id, account.parentId))
    .leftJoin(bankAccount, eq(bankAccount.id, account.id))

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
    )
})
