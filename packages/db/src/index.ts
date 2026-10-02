import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@app/env";
import { relations } from "./relations.js";

// The HTTP driver - stateless per-request, so it's safe anywhere that can
// only make HTTP calls (edge/other restricted runtimes), not just a
// traditional Node server. Uses DATABASE_URL, Neon's *pooled* connection
// string (via PgBouncer) - each call here is a short-lived logical
// connection, so pooling on Neon's side is what keeps that cheap.
// For a long-running Node server that wants real sessions/transactions and
// its own connection pool, use "@app/db/direct" instead.
const sql = neon(env.DATABASE_URL);

// Drizzle v1 takes a single config object; `relations` (not v0's `schema`)
// powers db.query.* relational queries.
export const db = drizzle({ client: sql, relations });

export { relations } from "./relations.js";
export * from "./schema.js";
