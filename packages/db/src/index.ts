import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { loadEnv, requireEnv } from "./env.js";
import * as schema from "./schema.js";

loadEnv();

// The HTTP driver - stateless per-request, so it's safe anywhere that can
// only make HTTP calls (edge/other restricted runtimes), not just a
// traditional Node server. Uses DATABASE_URL, Neon's *pooled* connection
// string (via PgBouncer) - each call here is a short-lived logical
// connection, so pooling on Neon's side is what keeps that cheap.
// For a long-running Node server that wants real sessions/transactions and
// its own connection pool, use "@app/db/direct" instead.
const sql = neon(requireEnv("DATABASE_URL"));

export const db = drizzle(sql, { schema });

export * from "./schema.js";
