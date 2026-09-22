import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which package's directory the process was started
// from, e.g. `pnpm --filter @app/bank-statement-importer ...`.
// const rootEnvPath = path.resolve(
//   path.dirname(fileURLToPath(import.meta.url)),
//   "../../../.env",
// );
// process.loadEnvFile(rootEnvPath);

const currentDir = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.resolve(currentDir, "../.env.local"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

process.loadEnvFile(path.resolve(currentDir, "../../../.env"));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to .env.");
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });

export * from "./schema.js";
