import { cn } from '#/lib/utils.ts';
import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { Link, createFileRoute, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { getBankAccounts } from '../-components/bank-accounts-fn.ts';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs';

export const Route = createFileRoute('/books/banking/recon/')({
  beforeLoad: async () => {
    const bankAccounts = await getBankAccounts();
    return { bankAccounts };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { bankAccounts } = Route.useRouteContext();
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Select Bank Account for Reconciliation" },
  ]);
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
      <h2 className="pb-2">Select Bank Account</h2>
      <p className="py-2">
        Select a bank account to reconcile against its bank statement.
      </p>
      <div className="mt-6 flex max-w-sm flex-col gap-4">
        {bankAccounts.map((bankAccount) => (
          <Link
            key={bankAccount.id}
            to="/books/banking/recon/$id"
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
  );
}
