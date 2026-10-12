import { queryOptions } from "@tanstack/react-query";
import { getAccounts, getAccountTypes } from "../-server/accounts.server.ts";

// Query keys for the Accounts page. Anything that changes an Account (rename,
// archive, bank details) invalidates accountKeys.all.
export const accountKeys = {
  all: ["accounts"] as const,
  list: () => [...accountKeys.all, "list"] as const,
  types: () => [...accountKeys.all, "types"] as const,
};

export const accountsQuery = queryOptions({
  queryKey: accountKeys.list(),
  queryFn: () => getAccounts(),
});

// Account Types only change with a migration, so they are kept for the whole
// page's life.
export const accountTypesQuery = queryOptions({
  queryKey: accountKeys.types(),
  queryFn: () => getAccountTypes(),
  staleTime: Infinity,
});
