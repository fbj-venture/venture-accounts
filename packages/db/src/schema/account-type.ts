import { integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

// Debit for Asset/Expense, Credit for Liability/Equity/Income (see
// docs/Ledger Ubiquitous Language.md). Drives how a Journal Line's signed
// amount should read to a user - the UI must join through this rather than
// hardcoding sign-to-meaning per account.
export const normalBalance = pgEnum("normal_balance", ["debit", "credit"]);

/**
 * Account type
 *
 * Contains the canonical list of account types:
 * - Asset: [Debit] What you own or are owed (Bank, Cash, Equipment, Accounts Receivable)
 * - Liability: [Credit] What you owe (Credit Card, Loans, Accounts Payable)
 * - Equity: [Credit] Net worth / ownership residual (Opening Balance, Retained Earnings)
 * - Income: [Credit] Money earned in a period (Salary, Sales Revenue)
 * - Expense: [Debit] Money spent in a period (Rent, Groceries, Utilities)
 */
export const accountType = pgTable("account_type", {
  id: integer("id").notNull().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  normalBalance: normalBalance("normal_balance").notNull(),
});
