CREATE TABLE "company_settings" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "company_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"financial_year_end_month" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "fye_month_range" CHECK ("financial_year_end_month" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");