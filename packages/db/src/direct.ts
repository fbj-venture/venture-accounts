import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadEnv, requireEnv } from "./env.js";
import { relations } from "./relations.js";

loadEnv();

// A real TCP connection with its own session/connection pool - for a
// long-running Node server (e.g. the TanStack Start server) that wants
// real transactions, not the stateless per-request HTTP driver in
// "@app/db"/"./index.js" (which restricted runtimes need instead).
//
// Uses DATABASE_URL_UNPOOLED, Neon's *unpooled* connection string -
// stacking pg.Pool's own pooling on top of Neon's PgBouncer
// (transaction-mode) pooling breaks things like prepared statement
// caching, so this must not reuse DATABASE_URL (which is pooled, for the
// HTTP driver).
const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL_UNPOOLED"),
});

// Drizzle v1 takes a single config object; `relations` (not v0's `schema`)
// powers db.query.* relational queries.
export const db = drizzle({ client: pool, relations });

export { relations } from "./relations.js";
export * from "./schema.js";
