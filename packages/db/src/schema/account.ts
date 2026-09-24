import { foreignKey, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { accountType } from "./account-type.js";

/**
 * Account ("Ledger account" in docs/Ledger Ubiquitous Language.md)
 *
 * The list of accounts (categories) that monies come from and go to.
 * E.g. Salaries, Woolworths, Bank accounts. Classified by exactly one
 * Account Type.
 *
 * "Account" is overloaded with the everyday sense of "bank account" - the
 * real institution/account-number details for a bank account live
 * separately in bankAccountDetails, 1:1 linked to a row here.
 */
export const account = pgTable("account", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  account_type: integer("account_type")
    .notNull()
    .references(() => accountType.id),
  parentId: integer()
},
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    })
  ]
);
