import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { banksQuery } from "#/routes/books/bank-account/-lib/bank-accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PdfImportForm } from "./-lib/pdf-import-form.tsx"

export const Route = createFileRoute("/books/banking/import/sb-statement")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(banksQuery)
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { data: banks } = useSuspenseQuery(banksQuery)
  const standardBank = banks.find((bank) => bank.name === "Standard Bank")
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Kind of Import", url: "/books/banking/import" },
    { title: "PDF Import from Standard Bank" },
  ])

  return (
    <>
      <h2 className="flex items-center gap-2">
        {/* 1em = the heading's font size (text-3xl, 1.875rem). */}
        <BankLogo logo={standardBank?.logo} name="Standard Bank" className="size-[1em]" />
        Standard Bank Statement Import (PDF)
      </h2>
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
