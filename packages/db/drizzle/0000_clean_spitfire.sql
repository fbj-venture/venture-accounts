CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"details" text NOT NULL,
	"service_fee" integer NOT NULL,
	"debits" integer NOT NULL,
	"credits" integer NOT NULL,
	"date" date NOT NULL,
	"balance" integer NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "transactions_hash_unique" UNIQUE("hash")
);
