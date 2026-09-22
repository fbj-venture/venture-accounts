import { accountType, db } from "../src/index.js";
import { runScript } from "./harness.js";

// Mirrors the canonical list documented on accountType in
// src/schema/account-type.ts. accountType.id isn't auto-generated, so
// these fixed IDs are the canonical reference for every account type.
const DEFAULT_ACCOUNT_TYPES = [
  {
    id: 1,
    name: "Asset",
    description:
      "What you own or are owed (Bank, Cash, Equipment, Accounts Receivable)",
    normalBalance: "debit" as const,
  },
  {
    id: 2,
    name: "Liability",
    description: "What you owe (Credit Card, Loans, Accounts Payable)",
    normalBalance: "credit" as const,
  },
  {
    id: 3,
    name: "Equity",
    description:
      "Net worth / ownership residual (Opening Balance, Retained Earnings)",
    normalBalance: "credit" as const,
  },
  {
    id: 4,
    name: "Income",
    description: "Money earned in a period (Salary, Sales Revenue)",
    normalBalance: "credit" as const,
  },
  {
    id: 5,
    name: "Expense",
    description: "Money spent in a period (Rent, Groceries, Utilities)",
    normalBalance: "debit" as const,
  },
];

await runScript("seed-account-types", async () => {
  for (const row of DEFAULT_ACCOUNT_TYPES) {
    await db.insert(accountType).values(row).onConflictDoNothing({
      target: accountType.id,
    });
    console.log(`  ensured account type: ${row.name}`);
  }
});
