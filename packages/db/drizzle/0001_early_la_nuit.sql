CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	CONSTRAINT "bank_accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "bank_account_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;