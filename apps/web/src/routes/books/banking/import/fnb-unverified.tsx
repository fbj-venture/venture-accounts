import { BankLogo } from "#/routes/books/-components/bank-logo.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { banksQuery } from "#/routes/books/bank-account/-lib/bank-accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/books/banking/import/fnb-unverified")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(banksQuery)
  },
  component: RouteComponent,
})

// Placeholder until the FNB statement layout has an extractor (see
// packages/bank-statement-importer).
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
        Import Unverified FNB Statement
      </h2>
      <p className="py-2 text-sm text-muted-foreground">
        Importing FNB statements is not available yet.
      </p>
    </>
  )
}
