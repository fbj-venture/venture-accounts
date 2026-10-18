import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db } from "../src/direct.js"
import { runScript } from "./harness.js"

await runScript("migrate", async () => {
  await migrate(db, { migrationsFolder: "./drizzle" })
})
