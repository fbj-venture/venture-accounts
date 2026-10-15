import { boolean, integer, snakeCase, text } from "drizzle-orm/pg-core"
import { account } from "./account.js"
import { auditColumns } from "./audit.js"

/**
 * Bank account details
 *
 * The real-world bank/institution details behind a ledger Account - kept
 * separate from `account` on purpose (see docs/Ledger Ubiquitous Language.md,
 * "Account" is overloaded). 1:1 with an `account` row via accountId.
 */
export const bankAccount = snakeCase.table("bank_account", {
  id: integer("id")
    .notNull()
    .primaryKey()
    .references(() => account.id),
  bankName: text("bank_name").notNull(),
  description: text("description").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  isArchived: boolean().notNull().default(false),
  ...auditColumns,
})
