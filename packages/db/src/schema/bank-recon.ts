import { date, index, integer, numeric, snakeCase, timestamp } from "drizzle-orm/pg-core";
import { bankAccount } from "./bank-account";

export const recon = snakeCase.table("bank_recon", {
   id: integer().primaryKey().generatedAlwaysAsIdentity(),
   bankAccountId: integer().notNull().references(() => bankAccount.id),
   openingBallance: numeric({ precision: 14, scale: 2, mode: "number" }).notNull(),
   closingBallance: numeric({ precision: 14, scale: 2, mode: "number" }).notNull(),
   statementDate: date().notNull(),
   ballancedAt: timestamp(),
   createdAt: timestamp().notNull().defaultNow()
}, (t) => [
   index().on(t.bankAccountId, t.ballancedAt)
]);
