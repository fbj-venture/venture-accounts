import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx';
import { BankAccountCard } from '#/routes/books/-components/bank-account-card.tsx';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { getBankAccountById } from '../-components/bank-accounts-fn.ts';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs';
import { getReconForm } from './-components/recon-fn.ts';
import { ReconForm } from './-components/recon-form.tsx';
import { ReconHistory } from './-components/recon-history.tsx';
import { useState } from 'react';

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
         <h2 className="pb-2">{bankAccount.name} Statement Recon</h2>
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
