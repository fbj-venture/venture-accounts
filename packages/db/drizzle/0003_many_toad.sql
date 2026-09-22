ALTER TABLE "account" RENAME COLUMN "type" TO "account_type";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_type_account_type_id_fk";
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_account_type_account_type_id_fk" FOREIGN KEY ("account_type") REFERENCES "public"."account_type"("id") ON DELETE no action ON UPDATE no action;