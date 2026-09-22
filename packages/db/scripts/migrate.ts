import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "../src/index.js";
import { runScript } from "./harness.js";

// drizzle-kit's own `migrate` command needs a websocket (Pool) connection,
// which @neondatabase/serverless only supports in specific environments.
// @app/db uses the plain-HTTPS neon-http driver everywhere else, so
// migrations run the same way, via drizzle-orm's neon-http migrator.
await runScript("migrate", async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
