import { boolean, date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Journal entry
 *
 * The envelope for one real-world Transaction; may contain several
 * Journal Lines. See docs/Ledger Ubiquitous Language.md - "Transaction" and
 * "Journal entry" are the same thing, referred to differently by audience
 * (the UI says "Transaction"; never introduce a third term for either).
 *
 * Reconciliation is tracked per Journal Line (journalLine.isReconciled), not
 * here: an entry can hold lines for two bank accounts (a matched Transfer),
 * and each bank's statement is reconciled separately.
 */
export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "date" }).notNull(),
  note: text("note").notNull(),
  isPosted: boolean("is_posted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
