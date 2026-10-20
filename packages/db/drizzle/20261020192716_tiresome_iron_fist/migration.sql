CREATE TABLE "bank" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL UNIQUE,
	"logo" text
);
--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "bank_id" integer;--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_bank_id_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank"("id");