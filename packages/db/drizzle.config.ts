import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which directory drizzle-kit was invoked from.
const rootEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
process.loadEnvFile(rootEnvPath);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to .env.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
