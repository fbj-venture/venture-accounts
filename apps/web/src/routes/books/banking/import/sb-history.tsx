import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { banksQuery } from "#/routes/books/bank-account/-lib/bank-accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PdfImportForm } from "./-lib/pdf-import-form.tsx"

export const Route = createFileRoute("/books/banking/import/sb-history")({
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
    { title: "Transaction History PDF from Standard Bank" },
  ])

  return (
    <>
      <h2 className="flex items-center gap-2">
        {/* 1em = the heading's font size (text-3xl, 1.875rem). */}
        <BankLogo logo={standardBank?.logo} name="Standard Bank" className="size-[1em]" />
        Import Standard Bank Transaction History (PDF)
      </h2>
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
