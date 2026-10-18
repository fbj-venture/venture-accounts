import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { ENV } from "varlock/env"
import { relations } from "./relations.js"

// A real TCP connection with its own session/connection pool, for a
// long-running Node server (e.g. the TanStack Start server) that wants real
// transactions. Works against any PostgreSQL, Neon included.
//
// Uses DATABASE_URL_UNPOOLED - Neon's *unpooled* connection string.
// Stacking pg.Pool's own pooling on top of Neon's PgBouncer (transaction-mode)
// pooling breaks things like prepared statement caching.
export const pool = new Pool({
  connectionString: ENV.DATABASE_URL_UNPOOLED,
})

// Neon suspends idle compute, which drops idle pooled connections. pg emits
// that as an 'error' event on the pool; with no listener Node would treat it
// as unhandled and crash the process. The pool discards the dead client and
// connects afresh on the next query, so logging is all that's needed.
pool.on("error", (error) => {
  console.error("Idle database client error:", error)
})

// Drizzle v1 takes a single config object; `relations` (not v0's `schema`)
// powers db.query.* relational queries.
export const db = drizzle({ client: pool, relations })

export { relations } from "./relations.js"
export * from "./schema.js"
