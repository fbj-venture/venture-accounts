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

  process.loadEnvFile(path.resolve(currentDir, "../../../.env"));
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.`);
  }
  return value;
}
