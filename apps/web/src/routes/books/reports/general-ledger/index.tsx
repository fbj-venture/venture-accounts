import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx"
import { formatZar } from "#/lib/currency.ts"
import { formatDate } from "#/lib/dates.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { accountTypesQuery } from "#/routes/books/accounts/-lib/accounts-queries.ts"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Fragment, useMemo, useState } from "react"
import { ReportFilterBar, type AppliedFilters } from "../-lib/report-filter-bar.tsx"
import { toCriteria, useExcelExport } from "../-lib/report-export.ts"
import { generalLedgerQuery } from "./-lib/general-ledger-queries.ts"
import { buildLedger, describeLine } from "./-lib/general-ledger-rows.ts"
import { exportGeneralLedgerToExcel } from "./-server/general-ledger-export.server.ts"

export const Route = createFileRoute("/books/reports/general-ledger/")({
  // Rendered in the browser only, like the Accounts page.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    // The report itself isn't loaded until the user presses Run.
    await queryClient.ensureQueryData(accountTypesQuery)
  },
  pendingComponent: () => (
    <p className="py-2 text-sm text-muted-foreground">Loading general ledger...</p>
  ),
  component: RouteComponent,
})

// A balance reads as a debit when positive and a credit when negative.
function formatBalance(balance: number) {
  return `${formatZar(Math.abs(balance))} ${balance < 0 ? "Cr" : "Dr"}`
}

const money = (amount: number) => (amount === 0 ? null : formatZar(amount))

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "General Ledger" }])

  // What the table shows: null until the report is first run.
  const [applied, setApplied] = useState<AppliedFilters | null>(null)
  const { data: lines = [], isLoading } = useQuery({
    ...generalLedgerQuery(toCriteria(applied?.range)),
    enabled: applied !== null,
  })
  const ledger = useMemo(() => (applied ? buildLedger(lines, applied) : []), [lines, applied])

  const excelExport = useExcelExport(applied, exportGeneralLedgerToExcel)

  return (
    <>
      <h2 className="pb-2">General Ledger</h2>
      <ReportFilterBar
        idPrefix="general-ledger"
        onRun={setApplied}
        applied={applied}
        exporting={excelExport.isPending}
        onExportExcel={() => excelExport.mutate()}
      />
      {excelExport.isError ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          The export failed: {excelExport.error.message}
        </p>
      ) : null}
      <p className="py-2 text-sm text-muted-foreground">
        Posted transactions only. Balances start from nothing at the start of the period.
      </p>
      <div className="mt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!applied || ledger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {!applied
                    ? "Report not yet run"
                    : isLoading
                      ? "Loading..."
                      : "No accounts with posted transactions."}
                </TableCell>
              </TableRow>
            ) : (
              ledger.map((section) => (
                <Fragment key={section.accountId}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={5} className="font-medium">
                      {section.fullName}
                      {section.isArchived ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (archived)
                        </span>
                      ) : null}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {section.accountType}
                      </span>
                    </TableCell>
                  </TableRow>
                  {section.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{describeLine(entry)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(entry.debit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(entry.credit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBalance(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium">
                    <TableCell colSpan={2}>Total {section.fullName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZar(section.debits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatZar(section.credits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBalance(section.balance)}
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
