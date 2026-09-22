import { db } from "./src/index.js";
import { sql } from "drizzle-orm";

const tables = await db.execute(sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`);
console.log("Tables in real DB:", tables.rows.map(r => r.table_name));

for (const t of tables.rows.map(r => r.table_name)) {
  const count = await db.execute(sql.raw(`select count(*)::int as count from "${t}"`));
  console.log(`  ${t}: ${count.rows[0].count} rows`);
}
