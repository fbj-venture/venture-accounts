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
  )
}
