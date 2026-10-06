import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { getBankAccountById } from '../-components/bank-accounts-fn.ts';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs';
import { getReconForm } from './-components/recon-fn.ts';
import { ReconForm } from './-components/recon-form.tsx';

export const Route = createFileRoute('/books/banking/recon/$id')({
   beforeLoad: async ({ params }) => {
      const bankAccount = await getBankAccountById({ data: params.id });
      if (!bankAccount) {
         throw notFound();
      }
      return { bankAccount };
   },
   loader: async ({ context }) => {
      const reconForm = await getReconForm({ data: context.bankAccount.id });
      return { reconForm };
   },
   component: RouteComponent,
});

function RouteComponent() {
   const { bankAccount } = Route.useRouteContext();
   const { reconForm } = Route.useLoaderData();
   useSetBreadcrumbs([
      { title: "Dashboard", url: "/books" },
      { title: "Select Bank Account for Reconciliation", url: "/books/banking/recon" },
      { title: `Reconcile ${bankAccount.name}` },
   ]);

   return (
      <>
         <h2 className="pb-2">{bankAccount.name} Statement Recon</h2>
         <div className="max-w-sm">
            <BankAccountCard bankAccount={bankAccount} />
         </div>
         <div className="mt-6">
            <ReconForm
               bankAccountId={bankAccount.id}
               initial={reconForm}
            />
         </div>
      </>
   );
}
