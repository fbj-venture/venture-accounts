import { sql } from "drizzle-orm"
import { check, integer, snakeCase, text } from "drizzle-orm/pg-core"
import { auditColumns } from "./audit"

export const company = snakeCase.table(
  "company_settings",
  {
    id: integer().notNull().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    financialYearEndMonth: integer().notNull(),
    // The first year offered by every year drop-down / date picker.
    startingYear: integer().notNull().default(2024),
    // Keys of the importers whose cards are hidden on the Kind of Import page
    // (see apps/web/src/lib/importers.ts). A new importer shows until hidden.
    hiddenImporters: text().array().notNull().default([]),
    ...auditColumns,
  },
  (t) => [check("fye_month_range", sql`${t.financialYearEndMonth} between 1 and 12`)],
)
