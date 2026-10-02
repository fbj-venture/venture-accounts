import { formatZar } from '#/lib/currency.ts';
import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs.ts';
import { getReconDetails } from './-components/recon-fn.ts';
import { ReconTransactionsTable } from './-components/recon-transactions-table.tsx';

// $id is the bank_recon.id. The static "session" segment keeps this apart
// from $id.tsx (a bank account) - two sibling dynamic segments would match
// the same URLs whatever their param names.
export const Route = createFileRoute('/books/banking/recon/session/$id')({
   loader: async ({ params }) => {
      const reconId = Number(params.id);
      const details = Number.isInteger(reconId) ? await getReconDetails({ data: reconId }) : null;
      if (!details) {
         throw notFound();
      }
      return { details };
   },
   component: RouteComponent,
});

const formatDay = (day: string) => format(parseISO(day), 'd MMM yyyy');

function RouteComponent() {
   const { details } = Route.useLoaderData();
   const { recon, bankAccount, transactions } = details;
   useSetBreadcrumbs([
      { title: "Dashboard", url: "/books" },
      { title: "Select Bank Account for Reconciliation", url: "/books/banking/recon" },
      { title: `Reconcile ${bankAccount.name}` },
   ]);

   return (
      <>
         <h2 className="pb-2">Reconcile {bankAccount.name}</h2>
         <div className="max-w-sm">
            <BankAccountCard bankAccount={bankAccount} />
         </div>
         <dl className="mt-6 grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Statement date</dt>
            <dd>{formatDay(recon.statementDate)}</dd>
            <dt className="text-muted-foreground">Opening balance</dt>
            <dd className="tabular-nums">{formatZar(recon.openingBalance)}</dd>
            <dt className="text-muted-foreground">Closing balance</dt>
            <dd className="tabular-nums">{formatZar(recon.closingBalance)}</dd>
         </dl>
         <h3 className="mt-6 pb-2">Transactions to reconcile</h3>
         <p className="pb-2 text-sm text-muted-foreground">
            Posted, unreconciled transactions up to {formatDay(recon.statementDate)}
         </p>
         <ReconTransactionsTable
            reconId={recon.id}
            openingBalance={recon.openingBalance}
            closingBalance={recon.closingBalance}
            isBalanced={recon.isBalanced}
            transactions={transactions}
         />
      </>
   );
}
