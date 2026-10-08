import { Button } from "#/components/ui/button.tsx";
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
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SearchResult } from "./search-fn.ts";
import { TransactionIdsDialog } from "./transaction-ids-dialog.tsx";

type SortKey = "date" | "bankAccount" | "description" | "account" | "amount" | "posted" | "reconciled";
type Sort = { key: SortKey; direction: "asc" | "desc" } | null;

// What each column sorts on. Ties keep the order the server returned (newest
// first), since Array.prototype.sort is stable.
const COMPARATORS: Record<SortKey, (a: SearchResult, b: SearchResult) => number> = {
  date: (a, b) => a.date.getTime() - b.date.getTime(),
  bankAccount: (a, b) => a.bankAccountName.localeCompare(b.bankAccountName),
  description: (a, b) => a.description.localeCompare(b.description),
  account: (a, b) => a.otherAccountNames.join(", ").localeCompare(b.otherAccountNames.join(", ")),
  amount: (a, b) => a.amount - b.amount,
  posted: (a, b) => Number(a.isPosted) - Number(b.isPosted),
  reconciled: (a, b) => Number(a.isReconciled) - Number(b.isReconciled),
};

// Clicking a header cycles ascending, descending, then back to the default
// order. Same look as the users table's sortable headers.
function SortableHead({
  sortKey,
  sort,
  onSort,
  title,
  className,
}: {
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  title: string;
  className?: string;
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const Icon = direction === "asc" ? ArrowUpIcon : direction === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <TableHead
      className={className}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      <Button
        variant="ghost"
        size="sm"
        className={className?.includes("text-right") ? "-mr-2.5" : "-ml-2.5"}
        onClick={() => onSort(sortKey)}
      >
        {title}
        <Icon className={direction ? undefined : "text-muted-foreground"} />
      </Button>
    </TableHead>
  );
}

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

  const [sort, setSort] = useState<Sort>(null);

  const rows = useMemo(() => {
    const predicate = parseAmountFilter(amountFilter);
    const filtered = predicate ? results.filter((row) => predicate(row.amount)) : results;
    if (!sort) {
      return filtered;
    }
    const compare = COMPARATORS[sort.key];
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * compare(a, b));
  }, [results, amountFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key !== key) {
        return { key, direction: "asc" };
      }
      return current.direction === "asc" ? { key, direction: "desc" } : null;
    });
  }

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
            <SortableHead sortKey="date" sort={sort} onSort={toggleSort} title="Date" />
            <SortableHead sortKey="bankAccount" sort={sort} onSort={toggleSort} title="Bank account" />
            <SortableHead sortKey="description" sort={sort} onSort={toggleSort} title="Description" />
            <SortableHead sortKey="account" sort={sort} onSort={toggleSort} title="Account" />
            <SortableHead sortKey="amount" sort={sort} onSort={toggleSort} title="Amount" className="text-right" />
            <SortableHead sortKey="posted" sort={sort} onSort={toggleSort} title="Posted" />
            <SortableHead sortKey="reconciled" sort={sort} onSort={toggleSort} title="Reconciled" />
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
