import { date, index, integer, numeric, snakeCase, timestamp } from "drizzle-orm/pg-core";
import { auditColumns } from "./audit";
import { bankAccount } from "./bank-account";
import { bankUpload } from "./bank-uploads";

export const recon = snakeCase.table("bank_recon", {
   id: integer().primaryKey().generatedAlwaysAsIdentity(),
   bankAccountId: integer().notNull().references(() => bankAccount.id),
   openingBallance: numeric({ precision: 14, scale: 2, mode: "number" }).notNull(),
   closingBallance: numeric({ precision: 14, scale: 2, mode: "number" }).notNull(),
   statementDate: date().notNull(),
   ballancedAt: timestamp(),
   // The uploaded statement this reconciliation was done from, if linked.
   bankUploadId: integer().references(() => bankUpload.id),
   ...auditColumns
}, (t) => [
   index().on(t.bankAccountId, t.ballancedAt)
]);
