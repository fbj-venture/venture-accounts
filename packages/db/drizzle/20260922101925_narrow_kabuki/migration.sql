CREATE TYPE "public"."normal_balance" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TABLE "bank_account" (
	"id" integer PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"description" text NOT NULL,
	"account_number" text NOT NULL,
	CONSTRAINT "bank_account_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "journal_line" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text,
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "account_type" TO "type";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_account_type_account_type_id_fk";
--> statement-breakpoint
ALTER TABLE "account_type" ADD COLUMN "normal_balance" "normal_balance" NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_id_account_id_fk" FOREIGN KEY ("id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_entry_id_journal_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_type_account_type_id_fk" FOREIGN KEY ("type") REFERENCES "public"."account_type"("id") ON DELETE no action ON UPDATE no action;