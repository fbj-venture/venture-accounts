import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { account, accountType, db } from "../src/index.js";
import { runScript } from "./harness.js";

// Imports the chart of accounts from accounts.json (next to this script).
// Each entry names its Account Type and, optionally, its parent Account by
// name - both are resolved to ids here. Re-runnable: accounts whose name
// already exists are left untouched.
type AccountEntry = {
  name: string;
  description?: string;
  accountType: string;
  parent?: string;
};

const ACCOUNTS_FILE = new URL("./accounts.json", import.meta.url);

await runScript("import-accounts", async () => {
  const raw = JSON.parse(await readFile(ACCOUNTS_FILE, "utf8")) as AccountEntry[];

  // Names in the source data carry stray whitespace ("Meals and entertainment ").
  const entries = raw.map((entry) => ({
    name: entry.name.trim(),
    description: entry.description?.trim() || null,
    accountType: entry.accountType.trim(),
    parent: entry.parent?.trim() || undefined,
  }));

  const accountTypeIds = new Map(
    (await db.select().from(accountType)).map((row) => [row.name, row.id]),
  );
  const accountIds = new Map(
    (await db.select({ id: account.id, name: account.name }).from(account)).map(
      (row) => [row.name, row.id],
    ),
  );

  // Validate everything up front - the HTTP driver has no transactions, so
  // bailing out before the first insert is what avoids a half-done import.
  const errors: string[] = [];
  const seen = new Set<string>();
  const namesInFile = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    if (seen.has(entry.name)) {
      errors.push(`duplicate account name: "${entry.name}"`);
    }
    seen.add(entry.name);

    if (!accountTypeIds.has(entry.accountType)) {
      errors.push(
        `"${entry.name}": unknown account type "${entry.accountType}" ` +
          `(expected one of ${[...accountTypeIds.keys()].join(", ")})`,
      );
    }

    if (
      entry.parent &&
      !namesInFile.has(entry.parent) &&
      !accountIds.has(entry.parent)
    ) {
      errors.push(`"${entry.name}": unknown parent account "${entry.parent}"`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`accounts.json is invalid:\n  ${errors.join("\n  ")}`);
  }

  // Insert parents before children: each pass inserts every entry whose
  // parent (if any) now has an id. A pass that makes no progress means the
  // remaining entries reference each other in a cycle.
  let pending = entries;
  while (pending.length > 0) {
    const ready = pending.filter(
      (entry) => !entry.parent || accountIds.has(entry.parent),
    );
    if (ready.length === 0) {
      throw new Error(
        `circular parent references: ${pending.map((entry) => entry.name).join(", ")}`,
      );
    }

    for (const entry of ready) {
      if (accountIds.has(entry.name)) {
        console.log(`  skipped (already exists): ${entry.name}`);
        continue;
      }

      const [created] = await db
        .insert(account)
        .values({
          name: entry.name,
          description: entry.description,
          account_type: accountTypeIds.get(entry.accountType)!,
          parentId: entry.parent ? accountIds.get(entry.parent)! : null,
        })
        .onConflictDoNothing({ target: account.name })
        .returning({ id: account.id });

      if (!created) {
        // Raced with another writer (or the row appeared after the initial
        // snapshot) - look up its id so any children can still resolve it
        // as a parent.
        const [existing] = await db
          .select({ id: account.id })
          .from(account)
          .where(eq(account.name, entry.name));
        accountIds.set(entry.name, existing!.id);
        console.log(`  skipped (already exists): ${entry.name}`);
        continue;
      }

      accountIds.set(entry.name, created.id);
      console.log(
        `  created account: ${entry.name}` +
          (entry.parent ? ` (under ${entry.parent})` : ""),
      );
    }

    pending = pending.filter((entry) => !ready.includes(entry));
  }
});
