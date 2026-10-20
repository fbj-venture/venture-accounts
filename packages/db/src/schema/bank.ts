import { integer, pgTable, text } from "drizzle-orm/pg-core"

export const bank = pgTable("bank", {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  logo: text(),
})
