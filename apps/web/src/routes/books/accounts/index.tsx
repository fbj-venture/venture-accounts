import { MultiSelect } from "#/components/multi-select.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import {
  ArchivedFilterCheckbox,
  matchesArchivedFilter,
  type ArchivedFilter,
} from "#/components/archived-filter.tsx"
import { SearchInput } from "#/components/search-input.tsx"
import { Separator } from "#/components/ui/separator.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { AddAccountDialog } from "./-lib/add-account-dialog.tsx"
import { accountKeys, accountsQuery, accountTypesQuery } from "./-lib/accounts-queries.ts"
import { AccountsTable } from "./-lib/accounts-table.tsx"

export const Route = createFileRoute("/books/accounts/")({
  // Rendered in the browser only: the loader fills the query cache (instantly
  // when it is still fresh) and the page reads it with useSuspenseQuery.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(accountsQuery),
      queryClient.ensureQueryData(accountTypesQuery),
    ])
  },
  pendingComponent: () => <p className="py-2 text-sm text-muted-foreground">Loading accounts...</p>,
  component: RouteComponent,
})

// The Account Types the list starts out showing.
const DEFAULT_TYPES = ["Expense", "Income"]

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Accounts" }])
  const { data: accounts } = useSuspenseQuery(accountsQuery)
  const { data: accountTypes } = useSuspenseQuery(accountTypesQuery)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  // The Accounts that can be a parent: every one that isn't a sub-account itself.
  const parents = useMemo(() => {
    return accounts
      .filter((row) => row.parentId === null)
      .map((row) => ({ id: row.id, name: row.fullName, accountTypeId: row.accountTypeId }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [accounts])

  // Resolves once the reloaded list has arrived, so the dialog doesn't close
  // on the old list. The router is refreshed too: the account selectors on the
  // transactions pages are still route-loader data, not queries.
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: accountKeys.all })
    await router.invalidate({ sync: true })
  }

  // Ticked Account Type ids; none ticked shows every type, as with the
  // other filters.
  const [typeIds, setTypeIds] = useState<number[]>(() =>
    accountTypes.filter((type) => DEFAULT_TYPES.includes(type.name)).map((type) => type.id),
  )
  const typeChoices = useMemo(
    () => accountTypes.map((type) => ({ value: type.id, label: type.name })),
    [accountTypes],
  )
  // Matched anywhere in the name (a sub-account's includes its parent's) or
  // the description, ignoring case.
  const [search, setSearch] = useState("")
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>("unarchived")
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return accounts.filter(
      (row) =>
        (typeIds.length === 0 || typeIds.includes(row.accountTypeId)) &&
        matchesArchivedFilter(archivedFilter, row.isArchived) &&
        (needle === "" ||
          row.fullName.toLowerCase().includes(needle) ||
          (row.description ?? "").toLowerCase().includes(needle)),
    )
  }, [accounts, typeIds, archivedFilter, search])

  return (
    <>
      <h2 className="pb-2">Accounts</h2>
      <div className="mt-2 flex items-end gap-4">
        <Field className="max-w-xs">
          <FieldLabel htmlFor="accounts-search">Search</FieldLabel>
          <SearchInput
            id="accounts-search"
            placeholder="Search name or description..."
            value={search}
            onValueChange={setSearch}
            autoComplete="off"
          />
        </Field>
        <Field className="max-w-xs">
          <FieldLabel htmlFor="accounts-types">Account types</FieldLabel>
          <MultiSelect
            id="accounts-types"
            options={typeChoices}
            value={typeIds}
            onValueChange={setTypeIds}
            placeholder="All account types"
          />
        </Field>
        <div className="flex h-9 items-center">
          <ArchivedFilterCheckbox
            id="accounts-archived"
            value={archivedFilter}
            onValueChange={setArchivedFilter}
          />
        </div>
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-9" />
        <Button type="button" onClick={() => setAdding(true)}>
          <PlusIcon />
          Add
        </Button>
      </div>
      {adding ? (
        <AddAccountDialog
          accountTypes={accountTypes}
          parents={parents}
          onClose={() => setAdding(false)}
          onAdded={refresh}
        />
      ) : null}
      <p className="py-2 text-sm text-muted-foreground">
        {shown.length === 1 ? "1 account." : `${shown.length} accounts.`}
      </p>
      <div className="mt-2">
        <AccountsTable data={shown} />
      </div>
    </>
  )
}
