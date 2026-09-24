import { createFileRoute, Outlet } from '@tanstack/react-router';
import { getAccountOptions } from "./-components/account-options-fn.ts";

// Layout route so the chart of accounts behind the AccountSelector loads
// once and is shared by every bank account's transactions page, instead of
// being refetched on each navigation. It rarely changes - anything that
// edits accounts should call router.invalidate() to refresh it.
export const Route = createFileRoute('/books/banking/transactions')({
  loader: async () => ({ accountOptions: await getAccountOptions() }),
  staleTime: Infinity,
  preloadStaleTime: Infinity,
  component: Outlet,
});
