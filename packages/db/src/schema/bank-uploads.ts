import { char, date, integer, pgEnum, snakeCase, text, uniqueIndex } from "drizzle-orm/pg-core"
import { auditColumns } from "./audit"
import { bankAccount } from "./bank-account"

// What an upload is: a bank statement, or a supporting document for an expense.
export const bankUploadCategory = pgEnum("bank_upload_category", ["statement", "expense"])

export const bankUpload = snakeCase.table(
  "bank_uploads",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bankId: integer()
      .notNull()
      .references(() => bankAccount.id),
    description: text().notNull(),
    fileUrl: text().notNull(),
    // SHA-256 of the file's bytes, as 64 lowercase hex characters.
    fileHash: char({ length: 64 }).notNull(),
    category: bankUploadCategory().notNull(),
    // The day the statement ends ("yyyy-MM-dd") - what the importer read from the
    // PDF; for a Transaction History PDF, the last day it covers.
    statementDate: date().notNull(),
    ...auditColumns,
  },
  (t) => [
    // The same file can't be recorded twice for a bank account.
    uniqueIndex().on(t.bankId, t.fileHash),
  ],
)
