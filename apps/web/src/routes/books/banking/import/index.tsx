import { SearchInput } from "#/components/search-input.tsx"
import { Card, CardDescription, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { banksQuery } from "#/routes/books/bank-account/-lib/bank-accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

export const Route = createFileRoute("/books/banking/import/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(banksQuery)
  },
  component: RouteComponent,
})

// The ways of importing bank transactions. Add an entry here (and its page
// next to this file) for each new importer. bankName is the bank table entry
// whose logo marks the importer.
const IMPORTERS = [
  {
    title: "Standard Bank Statement (PDF)",
    bankName: "Standard Bank",
    description:
      "Upload a Standard Bank statement in PDF format. The bank account and statement date are read from the statement.",
    to: "/books/banking/import/sb-statement",
  },
  {
    title: "Standard Bank Transaction History (PDF)",
    bankName: "Standard Bank",
    description:
      "Upload a Transaction History Statement downloaded from the bank's website, to import transactions before the monthly statement is issued.",
    to: "/books/banking/import/sb-history",
  },
] as const

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Kind of Import" }])

  const { data: banks } = useSuspenseQuery(banksQuery)

  // Matched anywhere in a title, ignoring case.
  const [filter, setFilter] = useState("")
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return IMPORTERS.filter((importer) => importer.title.toLowerCase().includes(needle))
  }, [filter])

  return (
    <>
      <h2 className="pb-2">Kind of Import</h2>
      <p className="py-2 text-sm text-muted-foreground">Choose what you want to import.</p>
      <SearchInput
        aria-label="Filter kinds of import"
        placeholder="Filter by title..."
        value={filter}
        onValueChange={setFilter}
        autoComplete="off"
        className="mt-2 w-xs"
      />
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No kind of import matches.</p>
      ) : null}
      <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
        {shown.map((importer) => (
          <Link key={importer.to} to={importer.to} className="group block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 transition-colors group-hover:text-primary">
                  <BankLogo
                    logo={banks.find((bank) => bank.name === importer.bankName)?.logo}
                    name={importer.bankName}
                  />
                  {importer.title}
                </CardTitle>
                <CardDescription>{importer.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
