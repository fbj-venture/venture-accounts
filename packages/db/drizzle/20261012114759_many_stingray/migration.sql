CREATE TABLE "app_settings" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "app_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"starting_year" integer DEFAULT 2000 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_user_id_account_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."account"("id");