import { queryOptions } from "@tanstack/react-query";
import { getBankAccounts } from "../-server/bank-accounts.server.ts";

// Query keys for the Bank accounts page. Editing a bank account invalidates
// bankAccountKeys.all.
export const bankAccountKeys = {
  all: ["bank-accounts"] as const,
  list: () => [...bankAccountKeys.all, "list"] as const,
};

export const bankAccountsQuery = queryOptions({
  queryKey: bankAccountKeys.list(),
  queryFn: () => getBankAccounts(),
});
