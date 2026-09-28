import path from "node:path";
import { fileURLToPath } from "node:url";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which package's directory the process was started
// from, e.g. `pnpm --filter @app/bank-statement-importer ...`.
export function loadEnv(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  try {
    process.loadEnvFile(path.resolve(currentDir, "../.env.local"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    process.loadEnvFile(path.resolve(currentDir, "../../../.env"));
  } catch (error) {
    // No .env file to load - fine in production, where the platform
    // (e.g. Railway) injects real env vars directly. Also covers a bundled
    // build (Nitro), where this module's location - and so the relative
    // path above - no longer matches the source layout at all.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.`);
  }
  return value;
}
