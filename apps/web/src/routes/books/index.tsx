import { getBankAccountBalances } from '#/routes/books/-components/bank-account-balances-fn.ts';
import { BankAccountMenu } from '#/routes/books/-components/bank-account-menu.tsx';
import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/books/')({
  loader: () => getBankAccountBalances(),
  component: RouteComponent,
});

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard' }]);
  const bankAccounts = Route.useLoaderData();

  return (
    <>
      <h2 className="pb-7">Accounts Dashboard</h2>
      <div className="flex w-full items-center gap-5">
        {bankAccounts.map((bankAccount) => (
          <BankAccountCard
            key={bankAccount.id}
            bankAccount={bankAccount}
            className="grow"
            footer={<BankAccountMenu bankAccountId={bankAccount.id} />}
          />
        ))}
      </div>
    </>
  );
}
