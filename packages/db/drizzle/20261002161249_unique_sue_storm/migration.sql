CREATE TABLE "bank_recon" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_recon_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_account_id" integer NOT NULL,
	"opening_ballance" numeric(14,2) NOT NULL,
	"closing_ballance" numeric(14,2) NOT NULL,
	"ballanced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bank_recon_bank_account_id_ballanced_at_index" ON "bank_recon" ("bank_account_id","ballanced_at");--> statement-breakpoint
CREATE INDEX "journal_line_account_id_index" ON "journal_line" ("account_id");--> statement-breakpoint
CREATE INDEX "journal_line_journal_entry_id_index" ON "journal_line" ("journal_entry_id");--> statement-breakpoint
ALTER TABLE "bank_recon" ADD CONSTRAINT "bank_recon_bank_account_id_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id");