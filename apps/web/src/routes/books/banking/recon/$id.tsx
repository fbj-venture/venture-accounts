import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx';
import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useState } from 'react';
import { loadBankAccount } from '../-components/bank-accounts-cache.ts';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs';
import { getReconForm } from './-components/recon-fn.ts';
import { ReconForm } from './-components/recon-form.tsx';
import { ReconHistory } from './-components/recon-history.tsx';

export const Route = createFileRoute('/books/banking/recon/$id')({
   beforeLoad: async ({ params }) => {
      const bankAccount = await loadBankAccount(params.id);
      if (!bankAccount) {
         throw notFound();
      }
      return { bankAccount };
   },
   loader: async ({ context }) => {
      const reconForm = await getReconForm({ data: context.bankAccount.id });
      return { reconForm };
   },
   // The form depends on the latest reconciliation, which changes whenever one
   // is balanced - so never show a cached copy when coming back to this page.
   staleTime: 0,
   gcTime: 0,
   component: RouteComponent,
});

// Traditional folder-style tabs: the active tab is outlined and joins the
// content below it.
const tabTriggerClass =
   'relative -mb-px h-auto flex-none rounded-b-none rounded-t-md border px-4 py-2 ' +
   'data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-background data-[state=active]:shadow-none ' +
   'dark:data-[state=active]:border-border dark:data-[state=active]:border-b-background dark:data-[state=active]:bg-background';

function RouteComponent() {
   const { bankAccount } = Route.useRouteContext();
   const { reconForm } = Route.useLoaderData();
   const [tab, setTab] = useState('form');
   // The history is fetched when its tab is first opened, then kept mounted.
   const [historyOpened, setHistoryOpened] = useState(false);
   const onTabChange = (value: string) => {
      setTab(value);
      if (value === 'history') {
         setHistoryOpened(true);
      }
   };
   useSetBreadcrumbs([
      { title: "Dashboard", url: "/books" },
      { title: "Select Bank Account for Reconciliation", url: "/books/banking/recon" },
      { title: `Reconcile ${bankAccount.name}` },
   ]);

   return (
      <>
         <h2 className="pb-2">{bankAccount.name} Bank Statement Recon</h2>
         <div className="max-w-sm">
            <BankAccountCard bankAccount={bankAccount} />
         </div>
         <Tabs value={tab} onValueChange={onTabChange} className="mt-6 gap-0">
            <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
               <TabsTrigger value="form" className={tabTriggerClass}>New Recon</TabsTrigger>
               <TabsTrigger value="history" className={tabTriggerClass}>History</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="pt-4">
               <ReconForm
                  // The form copies its starting values into state once, so a
                  // fresh set of figures needs a fresh form.
                  key={[
                     reconForm.reconId,
                     reconForm.openingBalance,
                     reconForm.closingBalance,
                     reconForm.statementDate,
                     reconForm.upload?.id,
                  ].join('|')}
                  bankAccountId={bankAccount.id}
                  initial={reconForm}
               />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
               {historyOpened ? <ReconHistory bankAccountId={bankAccount.id} /> : null}
            </TabsContent>
         </Tabs>
      </>
   );
}
