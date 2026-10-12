ALTER TABLE "app_settings" DROP CONSTRAINT "app_settings_user_id_account_id_fkey";--> statement-breakpoint
ALTER TABLE "app_settings" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "starting_year" SET DEFAULT 2024;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_user_id_key" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;