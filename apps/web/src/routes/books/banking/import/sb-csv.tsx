import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/books/banking/import/sb-csv")({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Kind of Import", url: "/books/banking/import" },
    { title: "TSV Import from Standard Bank" },
  ])

  return (
    <>
      <h2 className="pb-2">TSV Import from Standard Bank</h2>
      <div>Hello CSV import from Standard Bank</div>
    </>
  )
}
