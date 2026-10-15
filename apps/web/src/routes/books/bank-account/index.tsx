import {
  ArchivedFilterCheckbox,
  matchesArchivedFilter,
  type ArchivedFilter,
} from "#/components/archived-filter.tsx"
import { SearchInput } from "#/components/search-input.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Separator } from "#/components/ui/separator.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { accountKeys } from "#/routes/books/accounts/-lib/accounts-queries.ts"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { AddBankAccountDialog } from "./-lib/add-bank-account-dialog.tsx"
import { bankAccountKeys, bankAccountsQuery } from "./-lib/bank-accounts-queries.ts"
import { BankAccountsTable } from "./-lib/bank-accounts-table.tsx"

export const Route = createFileRoute("/books/bank-account/")({
  // Rendered in the browser only: the loader fills the query cache (instantly
  // when it is still fresh) and the page reads it with useSuspenseQuery.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(bankAccountsQuery)
  },
  pendingComponent: () => (
    <p className="py-2 text-sm text-muted-foreground">Loading bank accounts...</p>
  ),
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Bank accounts" }])
  const { data: bankAccounts } = useSuspenseQuery(bankAccountsQuery)
  const [filter, setFilter] = useState<ArchivedFilter>("unarchived")
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Resolves once the reloaded list has arrived, so the dialog doesn't close
  // on the old list. The Accounts page and the account selectors (still route
  // loader data) show the new account too.
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: bankAccountKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    ])
    await router.invalidate({ sync: true })
  }

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return bankAccounts.filter(
      (row) =>
        matchesArchivedFilter(filter, row.isArchived) &&
        (needle === "" ||
          [row.bankName, row.accountNumber, row.description].some((text) =>
            text.toLowerCase().includes(needle),
          )),
    )
  }, [bankAccounts, filter, search])

  return (
    <>
      <h2 className="pb-2">Bank Accounts</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <SearchInput
          aria-label="Search bank accounts"
          placeholder="Search bank, account number or description..."
          value={search}
          onValueChange={setSearch}
          className="w-xs"
        />
        <ArchivedFilterCheckbox
          id="bank-accounts-archived"
          value={filter}
          onValueChange={setFilter}
        />
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-9" />
        <Button type="button" onClick={() => setAdding(true)}>
          <PlusIcon />
          Add
        </Button>
      </div>
      {adding ? <AddBankAccountDialog onClose={() => setAdding(false)} onAdded={refresh} /> : null}
      <p className="py-2 text-sm text-muted-foreground">
        {shown.length === 1 ? "1 bank account." : `${shown.length} bank accounts.`}
      </p>
      <div className="mt-2">
        <BankAccountsTable data={shown} />
      </div>
    </>
  )
}
