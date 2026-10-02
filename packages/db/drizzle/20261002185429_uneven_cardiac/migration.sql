ALTER TABLE "journal_line" ADD COLUMN "bank_recon_id" integer;--> statement-breakpoint
CREATE INDEX "journal_line_bank_recon_id_index" ON "journal_line" ("bank_recon_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_bank_recon_id_bank_recon_id_fkey" FOREIGN KEY ("bank_recon_id") REFERENCES "bank_recon"("id");