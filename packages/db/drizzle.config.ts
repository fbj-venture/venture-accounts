import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which directory drizzle-kit was invoked from.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

// .env.local (this package only, gitignored) overrides the workspace root
// .env. Node's loadEnvFile() doesn't overwrite already-set variables, so
// it must be loaded first; it's optional, so a missing file is ignored.
try {
  const localEnvFile = path.resolve(currentDir, ".env.local")
  // console.log(localEnvFile);
  process.loadEnvFile(localEnvFile);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

process.loadEnvFile(path.resolve(currentDir, "../../.env"));

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
