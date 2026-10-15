import { Card, CardDescription, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import { SearchInput } from "#/components/search-input.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { Link, createFileRoute } from "@tanstack/react-router"
import { FileTextIcon } from "lucide-react"
import { useMemo, useState } from "react"

export const Route = createFileRoute("/books/banking/import/")({
  component: RouteComponent,
})

// The ways of importing bank transactions. Add an entry here (and its page
// next to this file) for each new importer.
const IMPORTERS = [
  {
    title: "Standard Bank Statement PDF",
    description:
      "Upload a Standard Bank statement in PDF format. The bank account and statement date are read from the statement.",
    to: "/books/banking/import/sb-statement",
  },
  {
    title: "Standard Bank Transactions TSV",
    description: "Upload a tab-separated (.tsv) file of transactions exported from Standard Bank.",
    to: "/books/banking/import/sb-csv",
  },
] as const

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Kind of Import" }])

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
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
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
