-- Audit trail: created_by / updated_by (and updated_at on bank_recon) on
-- bank_recon, journal and journal_line, all NOT NULL.
--
-- drizzle-kit generates "ADD COLUMN ... NOT NULL", which fails on tables that
-- already hold rows. So: add the columns nullable, attribute every existing
-- row to francis@venturechurch.co.za (the only person who has been entering
-- data so far), then make them NOT NULL.
ALTER TABLE "bank_recon" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_recon" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "bank_recon" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "journal" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "journal" ADD COLUMN "updated_by" text;--> statement-breakpoint
DO $$
DECLARE
  default_user text;
BEGIN
  SELECT "id" INTO default_user FROM "auth"."user" WHERE "email" = 'francis@venturechurch.co.za';

  IF default_user IS NULL AND (
    EXISTS (SELECT 1 FROM "bank_recon")
    OR EXISTS (SELECT 1 FROM "journal")
    OR EXISTS (SELECT 1 FROM "journal_line")
  ) THEN
    RAISE EXCEPTION 'Cannot backfill audit columns: user francis@venturechurch.co.za does not exist in auth.user';
  END IF;

  UPDATE "bank_recon" SET "created_by" = default_user, "updated_by" = default_user;
  UPDATE "journal" SET "created_by" = default_user, "updated_by" = default_user;
  UPDATE "journal_line" SET "created_by" = default_user, "updated_by" = default_user;
END $$;--> statement-breakpoint
ALTER TABLE "bank_recon" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_recon" ALTER COLUMN "updated_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_line" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_line" ALTER COLUMN "updated_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "journal" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "journal" ALTER COLUMN "updated_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_recon" ADD CONSTRAINT "bank_recon_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "bank_recon" ADD CONSTRAINT "bank_recon_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");
