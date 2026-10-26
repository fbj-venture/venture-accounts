import { requireUser } from "#/lib/require-user.server.ts"
import { account, accountType, bankAccount, db } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

// Keep ALL database code inside handlers - see the route folder layout in
// CLAUDE.md for why.

// What the Add expense form chooses from: the active bank accounts the money
// can come out of, and the active Expense accounts it can be charged to (a
// sub-account carries its parent's name).
export const getExpenseOptions = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser()
  const parent = alias(account, "parent")
  const [bankAccounts, expenseAccounts] = await Promise.all([
    db
      .select({ id: account.id, name: account.name })
      .from(bankAccount)
      .innerJoin(account, eq(account.id, bankAccount.id))
      .where(and(eq(bankAccount.isArchived, false), eq(account.isArchived, false)))
      .orderBy(asc(account.name)),
    db
      .select({ id: account.id, name: account.name, parentName: parent.name })
      .from(account)
      .innerJoin(accountType, eq(accountType.id, account.account_type))
      .leftJoin(parent, eq(parent.id, account.parentId))
      .where(and(eq(accountType.name, "Expense"), eq(account.isArchived, false)))
      .orderBy(asc(account.name)),
  ])
  // Sub-accounts directly under their parent, as the account selector lists them.
  const path = (row: (typeof expenseAccounts)[number]) =>
    row.parentName ? `${row.parentName}\u0000${row.name}` : row.name
  expenseAccounts.sort((a, b) => path(a).localeCompare(path(b)))
  return { bankAccounts, expenseAccounts }
})
