import { requireUser } from "#/lib/require-user.server.ts"
import { account, accountType, db, withCreate } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { validateImport, type ImportAccount } from "../-lib/accounts-import.ts"

// Keep ALL database code inside handlers - see the route folder layout in
// CLAUDE.md for why.

const key = (text: string) => text.trim().toLowerCase()

// Adds every account in the list that isn't in the books yet, or none: the
// whole list is checked first (the same rules the preview showed) and written
// in one transaction. An account whose name already exists is skipped, so
// importing the same list again adds nothing. Parents go in before their
// sub-accounts, which then point at them by id. Returns how many were added
// and how many were already there.
export const importAccounts = createServerFn({ method: "POST" })
  .validator((data: { items: ImportAccount[] }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    if (data.items.length === 0) {
      throw new Error("There are no accounts to import.")
    }

    return await db.transaction(async (tx) => {
      const types = await tx
        .select({ id: accountType.id, name: accountType.name })
        .from(accountType)
      const existing = await tx
        .select({
          id: account.id,
          name: account.name,
          parentId: account.parentId,
          accountType: accountType.name,
        })
        .from(account)
        .innerJoin(accountType, eq(accountType.id, account.account_type))

      const problems = validateImport(
        data.items,
        existing.map((row) => ({
          name: row.name,
          isSubAccount: row.parentId !== null,
          accountType: row.accountType,
        })),
        types.map((type) => type.name),
      )
      const firstProblem = problems.findIndex((check) => check.errors.length > 0)
      if (firstProblem !== -1) {
        const item = data.items[firstProblem]!
        throw new Error(
          `"${item.name.trim() || `Item ${firstProblem + 1}`}": ${problems[firstProblem]!.errors[0]}`,
        )
      }
      const toAdd = data.items.filter((_, index) => !problems[index]!.exists)

      const typeIds = new Map(types.map((type) => [key(type.name), type.id]))
      const toRow = (item: ImportAccount, parentId: number | null) => ({
        name: item.name.trim(),
        description: item.description.trim() === "" ? null : item.description.trim(),
        isArchived: item.isArchived,
        account_type: typeIds.get(key(item.accountType))!,
        parentId,
      })

      const parentIds = new Map(
        existing.filter((row) => row.parentId === null).map((row) => [key(row.name), row.id]),
      )
      const topLevel = toAdd.filter((item) => item.parent.trim() === "")
      if (topLevel.length > 0) {
        const created = await tx
          .insert(account)
          .values(
            withCreate(
              userId,
              topLevel.map((item) => toRow(item, null)),
            ),
          )
          .returning({ id: account.id, name: account.name })
        for (const row of created) {
          parentIds.set(key(row.name), row.id)
        }
      }

      const subAccounts = toAdd.filter((item) => item.parent.trim() !== "")
      if (subAccounts.length > 0) {
        await tx.insert(account).values(
          withCreate(
            userId,
            subAccounts.map((item) => toRow(item, parentIds.get(key(item.parent))!)),
          ),
        )
      }
      return { added: toAdd.length, skipped: data.items.length - toAdd.length }
    })
  })
