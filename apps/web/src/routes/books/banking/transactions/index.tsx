import { cn } from "#/lib/utils.ts";
import { BankAccountCard } from "#/routes/books/-components/bank-account-card.tsx";
import { useSetBreadcrumbs } from "#/routes/books/-components/breadcrumbs.ts";
import { Link, createFileRoute, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { loadBankAccounts } from "../-components/bank-accounts-cache.ts";

export const Route = createFileRoute('/books/banking/transactions/')({
  beforeLoad: async () => {
    const bankAccounts = await loadBankAccounts();
    return { bankAccounts };
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { bankAccounts } = Route.useRouteContext();
  useSetBreadcrumbs([{ title: "Select Bank Account for Unassigned Transactions" }]);
  const isNavigating = useRouterState({ select: (state) => state.isLoading });

  // cursor-progress (pointer + working spinner) applied to the whole pane,
  // not just this card list, since a page-level nav is in flight.
  useEffect(() => {
    document.body.classList.toggle("cursor-progress", isNavigating);
    return () => {
      document.body.classList.remove("cursor-progress");
    };
  }, [isNavigating]);

  return (
    <>
      <h2 className="pb-2 px-0">Post Transaction Accounts</h2>
      <p className="py-2">
        Select a bank account to display un-allocated transactions 
        for assigning Account categories.
      </p>
      <div className="mt-6 flex max-w-sm flex-col gap-4">
        {bankAccounts.map((bankAccount) => (
          <Link
            key={bankAccount.id}
            to="/books/banking/transactions/$id"
            params={{ id: String(bankAccount.id) }}
            aria-disabled={isNavigating}
            tabIndex={isNavigating ? -1 : undefined}
            onClick={(event) => {
              if (isNavigating) {
                event.preventDefault();
              }
            }}
            className={cn(isNavigating && "pointer-events-none")}
          >
            <BankAccountCard
              bankAccount={bankAccount}
              className={cn(
                "transition-colors hover:bg-accent",
                isNavigating && "opacity-60",
              )}
            />
          </Link>
        ))}
      </div>
    </>
  )
}
