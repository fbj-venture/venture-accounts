import { pgSchema } from "drizzle-orm/pg-core";

// Auth tables (better-auth) live in their own Postgres schema, kept
// separate from the accounting domain's "public" tables.
export const authSchema = pgSchema("auth");
