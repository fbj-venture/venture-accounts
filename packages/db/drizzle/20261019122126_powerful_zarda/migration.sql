ALTER TABLE "company_settings" ADD COLUMN "starting_year" integer DEFAULT 2024 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "starting_year";