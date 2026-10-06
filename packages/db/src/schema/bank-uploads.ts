import { char, integer, snakeCase, text, uniqueIndex } from "drizzle-orm/pg-core";
import { auditColumns } from "./audit";
import { bankAccount } from "./bank-account";

export const bankUpload = snakeCase.table("bank_uploads", {
   id: integer().primaryKey().generatedAlwaysAsIdentity(),
   bankId: integer().notNull().references(() => bankAccount.id),
   description: text().notNull(),
   fileUrl: text().notNull(),
   // SHA-256 of the file's bytes, as 64 lowercase hex characters.
   fileHash: char({ length: 64 }).notNull(),
   ...auditColumns
}, (t) => [
   // The same file can't be recorded twice for a bank account.
   uniqueIndex().on(t.bankId, t.fileHash)
])
