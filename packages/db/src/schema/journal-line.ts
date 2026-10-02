import { boolean, index, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { account } from "./account.js";
import { recon } from "./bank-recon.js";
import { journal } from "./journal.js";

/**
 * Journal line ("posting" in docs/Ledger Ubiquitous Language.md)
 *
 * One account + signed amount within a Journal Entry. A positive amount is
 * a debit, negative is a credit - never shown to the user as those words.
 * Every Journal Entry's lines should sum to zero; that invariant isn't
 * enforced at the database level yet (see the doc's "Balancing" note).
 */
export const journalLine = pgTable("journal_line", {
  id: serial("id").primaryKey(),
  description: text("description"),
  journalEntryId: integer("journal_entry_id")
    .notNull()
    .references(() => journal.id),
  accountId: integer("account_id")
    .notNull()
    .references(() => account.id),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  hash: text("import_hash"),
  // Ticked off against this line's bank statement. Per line, not per entry:
  // a matched Transfer's entry has a line for each bank, and each bank's
  // statement is reconciled on its own.
  isReconciled: boolean("is_reconciled").notNull().default(false),
  // The bank reconciliation that ticked this line off - set together with
  // isReconciled, so a reconciliation can show (and total) its own lines.
  bankReconId: integer("bank_recon_id").references(() => recon.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index().on(t.accountId),
  index().on(t.journalEntryId),
  index().on(t.bankReconId),
]);
