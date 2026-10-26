import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core"
import { auditColumns } from "./audit.js"
import { journalLine } from "./journal-line.js"

/**
 * A file kept with a Journal line as evidence, e.g. the photo of the receipt
 * for an expense added by hand (kept on the bank account's line).
 *
 * The file lives in file storage under fileKey - a key, not a URL: the bucket
 * is private and download links are temporary (see getFileUrl in
 * @app/storage). A bank line that has one is a hand-entered expense that the
 * bank statement import should match with, rather than duplicate.
 */
export const journalAttachment = pgTable(
  "journal_attachment",
  {
    id: serial("id").primaryKey(),
    journalLineId: integer("journal_line_id")
      .notNull()
      .references(() => journalLine.id),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    ...auditColumns,
  },
  (t) => [index().on(t.journalLineId)],
)
