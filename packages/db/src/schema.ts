import { date, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull().unique(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id")
    .notNull()
    .references(() => bankAccounts.id),
  details: text("details").notNull(),
  // Money columns are integer cents (ZAR), matching @app/models' Transaction.
  serviceFee: integer("service_fee").notNull(),
  debits: integer("debits").notNull(),
  credits: integer("credits").notNull(),
  date: date("date", { mode: "date" }).notNull(),
  balance: integer("balance").notNull(),
  // Fingerprint of the source transaction, used to keep re-imports
  // idempotent (see @app/bank-statement-importer's hashRow).
  hash: text("hash").notNull().unique(),
});
