CREATE TABLE "journal_attachment" (
	"id" serial PRIMARY KEY,
	"journal_line_id" integer NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "journal_attachment_journal_line_id_index" ON "journal_attachment" ("journal_line_id");--> statement-breakpoint
ALTER TABLE "journal_attachment" ADD CONSTRAINT "journal_attachment_journal_line_id_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_line"("id");--> statement-breakpoint
ALTER TABLE "journal_attachment" ADD CONSTRAINT "journal_attachment_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id");--> statement-breakpoint
ALTER TABLE "journal_attachment" ADD CONSTRAINT "journal_attachment_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id");