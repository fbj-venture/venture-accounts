ALTER TABLE "journal_line" ADD COLUMN "is_reconciled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "journal" DROP COLUMN "is_reconciled";