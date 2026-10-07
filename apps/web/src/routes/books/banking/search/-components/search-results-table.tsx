import { Checkbox } from "#/components/ui/checkbox.tsx";
import { TablePagination } from "#/components/table-pagination.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useTablePageSize } from "#/hooks/use-table-page-size.ts";
import { parseAmountFilter } from "#/lib/amount-filter.ts";
import { formatZar } from "#/lib/currency.ts";
import { useEffect, useMemo, useState } from "react";
import type { SearchResult } from "./search-fn.ts";
import { TransactionIdsDialog } from "./transaction-ids-dialog.tsx";

// A tick for display only: it ignores the pointer (so a click falls through to
// the row) and stays out of the tab order.
function ReadOnlyCheckbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <Checkbox
      checked={checked}
      tabIndex={-1}
      aria-readonly
      aria-label={label}
      className="pointer-events-none"
    />
  );
}

// The search's results, paginated at the page size saved for every table.
// The amount expression is applied here, over what the server returned.
export function SearchResultsTable({
  results,
  amountFilter,
  isAdmin,
}: {
  results: SearchResult[];
  amountFilter: string;
  /** Administrators can click a row to see its database ids. */
  isAdmin: boolean;
}) {
  const [idsFor, setIdsFor] = useState<number | null>(null);
  const [pageSize] = useTablePageSize();
  const [requestedPageIndex, setPageIndex] = useState(0);

  const rows = useMemo(() => {
    const predicate = parseAmountFilter(amountFilter);
    return predicate ? results.filter((row) => predicate(row.amount)) : results;
  }, [results, amountFilter]);

  // A new search or a different page size starts again from page 1.
  useEffect(() => {
    setPageIndex(0);
  }, [rows, pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const pagination = {
    getState: () => ({ pagination: { pageIndex } }),
    getPageCount: () => pageCount,
    getCanPreviousPage: () => pageIndex > 0,
    getCanNextPage: () => pageIndex < pageCount - 1,
    previousPage: () => setPageIndex(pageIndex - 1),
    nextPage: () => setPageIndex(pageIndex + 1),
  };

  return (
    <>
      <p className="pb-2 text-sm text-muted-foreground">
        {rows.length === 1 ? "1 transaction found." : `${rows.length} transactions found.`}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Bank account</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Posted</TableHead>
            <TableHead>Reconciled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length ? (
            pageRows.map((row) => (
              <TableRow
                key={row.journalLineId}
                className={isAdmin ? "cursor-pointer" : undefined}
                tabIndex={isAdmin ? 0 : undefined}
                onClick={isAdmin ? () => setIdsFor(row.journalLineId) : undefined}
                onKeyDown={
                  isAdmin
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setIdsFor(row.journalLineId);
                        }
                      }
                    : undefined
                }
              >
                <TableCell>{row.date.toLocaleDateString("en-ZA")}</TableCell>
                <TableCell>{row.bankAccountName}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.otherAccountNames.join(", ")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatZar(row.amount)}</TableCell>
                <TableCell>
                  <ReadOnlyCheckbox checked={row.isPosted} label="Posted" />
                </TableCell>
                <TableCell>
                  <ReadOnlyCheckbox checked={row.isReconciled} label="Reconciled" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No transactions match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination table={pagination} />
      {isAdmin ? (
        <TransactionIdsDialog journalLineId={idsFor} onClose={() => setIdsFor(null)} />
      ) : null}
    </>
  );
}
