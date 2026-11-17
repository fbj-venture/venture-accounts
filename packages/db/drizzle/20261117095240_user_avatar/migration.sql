CREATE TABLE "auth"."user_avatar" (
	"user_id" text PRIMARY KEY,
	"data" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."user_avatar" ADD CONSTRAINT "user_avatar_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "auth"."user_avatar" ("user_id", "data", "updated_at")
SELECT "id", "image", "updated_at" FROM "auth"."user" WHERE "image" LIKE 'data:image/jpeg;base64,%';
--> statement-breakpoint
UPDATE "auth"."user"
SET "image" = '/api/avatar/' || "id" || '?v=' || (extract(epoch FROM "updated_at") * 1000)::bigint
WHERE "image" LIKE 'data:image/jpeg;base64,%';
