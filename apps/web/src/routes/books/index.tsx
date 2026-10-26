import { AddExpenseCard } from "#/routes/books/-components/add-expense-card"
import { BankAccountCard } from "#/routes/books/-components/bank-account-card"
import { BankAccountMenu } from "#/routes/books/-components/bank-account-menu"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs"
import { getBankAccountBalances } from "#/routes/books/-server/bank-account-balances.server.ts"
import { companySettingsQuery } from "#/routes/books/admin/company/-lib/company-queries.ts"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/books/")({
  loader: async ({ context: { queryClient } }) => {
    // The company settings fill the query cache (the sidebar title reads them);
    // the page itself only needs the balances.
    const [balances] = await Promise.all([
      getBankAccountBalances(),
      queryClient.ensureQueryData(companySettingsQuery),
    ])
    return balances
  },
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard" }])
  const bankAccounts = Route.useLoaderData()

  return (
    <>
      <h2 className="pb-7">Accounts Dashboard</h2>
      {/* The first group: shortcuts for adding things. */}
      <div className="flex w-full flex-col gap-5 pb-8 sm:flex-row sm:flex-wrap">
        <AddExpenseCard bankAccounts={bankAccounts} className="grow sm:max-w-md sm:basis-72" />
      </div>
      {/* Stacked on mobile; from sm up the cards flow in rows and wrap. */}
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:flex-wrap">
        {bankAccounts.map((bankAccount) => (
          <BankAccountCard
            key={bankAccount.id}
            bankAccount={bankAccount}
            className="grow transition-colors hover:border-primary **:data-[slot=card-title]:transition-colors hover:**:data-[slot=card-title]:text-primary sm:basis-72"
            footer={<BankAccountMenu bankAccountId={bankAccount.id} />}
          />
        ))}
      </div>
    </>
  )
}
