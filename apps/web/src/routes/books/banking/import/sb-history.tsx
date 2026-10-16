import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { createFileRoute } from "@tanstack/react-router"
import { PdfImportForm } from "./-lib/pdf-import-form.tsx"

export const Route = createFileRoute("/books/banking/import/sb-history")({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Kind of Import", url: "/books/banking/import" },
    { title: "Transaction History PDF from Standard Bank" },
  ])

  return (
    <>
      <h2>Import Standard Bank Transaction History (PDF)</h2>
      <p className="py-2">
        Upload a Transaction History Statement downloaded from the bank&apos;s website, to bring
        transactions in before the monthly statement is issued. Everything in it will also appear on
        the monthly statement; when that is imported later, the transactions already imported here
        are recognised and skipped.
      </p>
      <p className="py-2 text-sm text-muted-foreground">
        Items still pending at the bank (such as outstanding card authorisations) are not imported.
        The bank account must already exist, and its number is read from the PDF.
      </p>

      <PdfImportForm
        layout="history"
        fileLabel="Transaction history"
        defaultDescription="Transaction history from the bank's website"
        submitLabel="Upload transaction history"
      />
    </>
  )
}
