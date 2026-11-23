CREATE TYPE "bank_upload_category" AS ENUM('statement', 'expense');--> statement-breakpoint
ALTER TABLE "bank_uploads" ADD COLUMN "category" "bank_upload_category";