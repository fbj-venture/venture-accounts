import { account, bankAccount, db } from "../src/index.js";
import { runScript } from "./harness.js";

const ASSET_ACCOUNT_TYPE_ID = 1;

// STUB: fill in real values for each of the 4 bank accounts before running.
const BANK_ACCOUNTS = [
  {
    name: "Current Account",
    description: "Standard Bank Current Account",
    bankName: "Standard Bank",
    accountNumber: "420287035",
  },
  {
    name: "Building Fund",
    description: "Building fund",
    bankName: "Standard Bank",
    accountNumber: "407186638",
  },
  {
    name: "Missions Account",
    description: "Venture Church Missions Account",
    bankName: "Standard Bank",
    accountNumber: "425734552",
  },
  {
    name: "Africa Missions",
    description: "Africa Missions Account",
    bankName: "Standard Bank",
    accountNumber: "003888711",
  },
];

await runScript("seed-bank-accounts", async () => {
  for (const entry of BANK_ACCOUNTS) {
    // bankAccount.id isn't auto-generated - it reuses its linked account's
    // id (the 1:1 relationship), so the account has to be inserted first.
    const [createdAccount] = await db
      .insert(account)
      .values({
        name: entry.name,
        description: entry.description,
        account_type: ASSET_ACCOUNT_TYPE_ID,
      })
      .onConflictDoNothing({ target: account.name })
      .returning();

    if (!createdAccount) {
      console.log(`  skipped (already exists): ${entry.name}`);
      continue;
    }

    await db.insert(bankAccount).values({
      id: createdAccount.id,
      bankName: entry.bankName,
      description: entry.description,
      accountNumber: entry.accountNumber,
    });

    console.log(`  created bank account: ${entry.name}`);
  }
});
