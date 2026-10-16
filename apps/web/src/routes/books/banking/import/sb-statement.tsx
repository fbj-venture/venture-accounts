import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { createFileRoute } from "@tanstack/react-router"
import { PdfImportForm } from "./-lib/pdf-import-form.tsx"

export const Route = createFileRoute("/books/banking/import/sb-statement")({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Kind of Import", url: "/books/banking/import" },
    { title: "PDF Import from Standard Bank" },
  ])

  return (
    <>
      <h2>Standard Bank Statement Import (PDF)</h2>
      <p className="py-2">
        The import feature currently only supports uploading Standard Bank statements in PDF format,
        and without passwords. The bank account number and statement date will be read from the
        uploaded PDF.
      </p>

      <PdfImportForm
        layout="statement"
        fileLabel="Bank statement"
        defaultDescription="Uploading bank statement"
        submitLabel="Upload statement"
      />
    </>
  )
}
