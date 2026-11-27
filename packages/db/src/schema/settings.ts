import { integer, snakeCase, text } from "drizzle-orm/pg-core"
import { user } from "./auth.js"

// One row of app settings per user, created with these defaults the first
// time the user signs in (see getOrCreateSettings in the web app).
export const settings = snakeCase.table("app_settings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // The user's own order of the bank accounts (their account ids) on the
  // dashboard. Accounts missing from the list (e.g. newly added) sort after
  // the listed ones, by name.
  bankAccountOrder: integer().array().notNull().default([]),
})
