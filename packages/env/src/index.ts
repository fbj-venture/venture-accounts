import { createEnv } from "@t3-oss/env-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which package's directory the process was started
// from. Node's loadEnvFile() doesn't overwrite already-set variables, so
// the overriding file must be loaded first.
function loadEnvFile(file: string): void {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    // No file to load - fine in production, where the platform (e.g.
    // Railway) injects real env vars directly. Also covers a bundled build
    // (Nitro), where this module's location - and so the relative paths
    // below - no longer matches the source layout at all.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// packages/db/.env.local (gitignored) overrides the workspace root .env.
loadEnvFile(path.resolve(currentDir, "../../db/.env.local"));
loadEnvFile(path.resolve(currentDir, "../../../.env"));

export const env = createEnv({
  server: {
    // Neon's *pooled* connection string, for the HTTP driver.
    DATABASE_URL: z.url(),
    // Neon's *unpooled* connection string, for the pg.Pool driver.
    DATABASE_URL_UNPOOLED: z.url(),
    NEON_BRANCH: z.string().optional(),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    APP_COMPANY: z.string().min(1).default("Venture"),
    PDF_PASSWORD: z.string().optional(),
  },
  runtimeEnv: process.env,
  // An empty value in .env (e.g. "BETTER_AUTH_SECRET=") counts as unset.
  emptyStringAsUndefined: true,
});
