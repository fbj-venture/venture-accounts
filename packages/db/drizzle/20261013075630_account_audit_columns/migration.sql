-- Audit trail: created_by / updated_by on account and bank_account, both
-- NOT NULL.
--
-- drizzle-kit generates "ADD COLUMN ... NOT NULL", which fails on tables that
-- already hold rows. So: add the columns nullable, attribute every existing
-- row to francis@venturechurch.co.za (the only person who has been entering
-- data so far), then make them NOT NULL.
ALTER TABLE "account" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "updated_by" text;--> statement-breakpoint
DO $$
DECLARE
  default_user text;
BEGIN
  SELECT "id" INTO default_user FROM "auth"."user" WHERE "email" = 'francis@venturechurch.co.za';

  IF default_user IS NULL AND (
    EXISTS (SELECT 1 FROM "account")
    OR EXISTS (SELECT 1 FROM "bank_account")
  ) THEN
    RAISE EXCEPTION 'Cannot backfill audit columns: user francis@venturechurch.co.za does not exist in auth.user';
  END IF;

  UPDATE "account" SET "created_by" = default_user, "updated_by" = default_user;
  UPDATE "bank_account" SET "created_by" = default_user, "updated_by" = default_user;
END $$;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_account" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_account" ALTER COLUMN "updated_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");
