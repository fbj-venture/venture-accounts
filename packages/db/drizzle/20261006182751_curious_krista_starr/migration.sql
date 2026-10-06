CREATE TABLE "bank_uploads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_uploads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_id" integer NOT NULL,
	"description" text NOT NULL,
	"file_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_uploads" ADD CONSTRAINT "bank_uploads_bank_id_bank_account_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank_account"("id");--> statement-breakpoint
ALTER TABLE "bank_uploads" ADD CONSTRAINT "bank_uploads_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "bank_uploads" ADD CONSTRAINT "bank_uploads_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");