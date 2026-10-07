import { getBankAccounts, type BankAccountDetails } from "./bank-accounts-fn.ts";

// The bank accounts are loaded once, the first time they're needed in the
// browser, and that same list is reused by every page afterwards (until the
// page is reloaded or clearBankAccountsCache() is called). On the server
// (SSR) nothing is kept between requests, so a render never sees another
// request's data.
let cached: Promise<BankAccountDetails[]> | undefined;

export function loadBankAccounts(): Promise<BankAccountDetails[]> {
  if (typeof window === "undefined") {
    return getBankAccounts();
  }
  cached ??= getBankAccounts().catch((error) => {
    // Don't keep a failure - the next caller tries again.
    cached = undefined;
    throw error;
  });
  return cached;
}

// The bank account with this id (a route param), or null if there isn't one.
export async function loadBankAccount(id: string): Promise<BankAccountDetails | null> {
  const accountId = Number(id);
  const bankAccounts = await loadBankAccounts();
  return bankAccounts.find((bankAccount) => bankAccount.id === accountId) ?? null;
}

// Call after anything that adds or changes a bank account.
export function clearBankAccountsCache() {
  cached = undefined;
}
