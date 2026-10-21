import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { banksQuery } from "#/routes/books/bank-account/-lib/bank-accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PdfImportForm } from "./-lib/pdf-import-form.tsx"

export const Route = createFileRoute("/books/banking/import/fnb-unverified")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(banksQuery)
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { data: banks } = useSuspenseQuery(banksQuery)
  const fnb = banks.find((bank) => bank.name === "FNB")
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Kind of Import", url: "/books/banking/import" },
    { title: "Unverified Statement from FNB" },
  ])

  return (
    <>
      <h2 className="flex items-center gap-2">
        {/* 1em = the heading's font size (text-3xl, 1.875rem). */}
        <BankLogo logo={fnb?.logo} name="FNB" className="size-[1em]" />
        Import FNB Unverified Statements
      </h2>
      <p className="py-2">
        Upload an FNB statement in PDF format, such as the FNB Aspire Current Account statement. The
        bank account and statement date are read from the statement.
      </p>
      <p className="py-2 text-sm text-muted-foreground">
        The bank account must already exist, with the account number printed on the statement.
        Transactions already imported are recognised and skipped.
      </p>

      <PdfImportForm
        layout="fnb"
        fileLabel="FNB statement"
        defaultDescription="Unverified FNB statement"
        submitLabel="Upload FNB statement"
      />
    </>
  )
}
