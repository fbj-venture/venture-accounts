import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx"
import { formatZar } from "#/lib/currency.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { accountTypesQuery } from "#/routes/books/accounts/-lib/accounts-queries.ts"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { ReportFilterBar, type AppliedFilters } from "../-lib/report-filter-bar.tsx"
import { toCriteria, useExcelExport } from "../-lib/report-export.ts"
import { filterRows } from "../-lib/report-rows.ts"
import { trialBalanceQuery } from "./-lib/trial-balance-queries.ts"
import { totalRows } from "./-lib/trial-balance-rows.ts"
import { exportTrialBalanceToExcel } from "./-server/trial-balance-export.server.ts"

export const Route = createFileRoute("/books/reports/trial-ballance/")({
  // Rendered in the browser only, like the Accounts page.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    // The report itself isn't loaded until the user presses Run.
    await queryClient.ensureQueryData(accountTypesQuery)
  },
  pendingComponent: () => (
    <p className="py-2 text-sm text-muted-foreground">Loading trial balance...</p>
  ),
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Trial Balance" }])
  const { data: accountTypes } = useSuspenseQuery(accountTypesQuery)

  // What the table shows: null until the report is first run.
  const [applied, setApplied] = useState<AppliedFilters | null>(null)
  const { data: rows = [], isLoading } = useQuery({
    ...trialBalanceQuery(toCriteria(applied?.range)),
    enabled: applied !== null,
  })

  const shown = useMemo(() => (applied ? filterRows(rows, applied) : []), [rows, applied])
  const { debits, credits } = useMemo(() => totalRows(shown), [shown])
  const allTypes =
    !applied || applied.typeIds.length === 0 || applied.typeIds.length === accountTypes.length

  const excelExport = useExcelExport(applied, exportTrialBalanceToExcel)

  return (
    <>
      <h2 className="pb-2">Trial Balance</h2>
      <ReportFilterBar
        idPrefix="trial-balance"
        onRun={setApplied}
        canExport={applied !== null}
        exporting={excelExport.isPending}
        onExportExcel={() => excelExport.mutate()}
      />
      {excelExport.isError ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          The export failed: {excelExport.error.message}
        </p>
      ) : null}
      <p className="py-2 text-sm text-muted-foreground">
        Posted transactions only.
        {allTypes ? null : " The totals only balance when every account type is included."}
      </p>
      <div className="mt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!applied || shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {!applied
                    ? "Report not yet run"
                    : isLoading
                      ? "Loading..."
                      : "No accounts with posted transactions."}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.fullName}
                    {row.isArchived ? (
                      <span className="ml-2 text-xs text-muted-foreground">(archived)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.accountType}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.balance > 0 ? formatZar(row.balance) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.balance < 0 ? formatZar(-row.balance) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {applied ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatZar(debits)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatZar(credits)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </>
  )
}
