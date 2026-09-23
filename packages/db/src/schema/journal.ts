import { boolean, date, pgTable, serial, text } from "drizzle-orm/pg-core";

/**
 * Journal entry
 *
 * The envelope for one real-world Transaction; may contain several
 * Journal Lines. See docs/Ledger Ubiquitous Language.md - "Transaction" and
 * "Journal entry" are the same thing, referred to differently by audience
 * (the UI says "Transaction"; never introduce a third term for either).
 */
export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  note: text("note").notNull(),
  isPosted: boolean("is_posted").notNull().default(false),
  isReconciled: boolean("is_reconciled").notNull().default(false),
});
