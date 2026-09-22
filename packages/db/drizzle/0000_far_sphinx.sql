CREATE TABLE "account_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "account_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_type" integer NOT NULL,
	CONSTRAINT "account_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_account_type_account_type_id_fk" FOREIGN KEY ("account_type") REFERENCES "public"."account_type"("id") ON DELETE no action ON UPDATE no action;