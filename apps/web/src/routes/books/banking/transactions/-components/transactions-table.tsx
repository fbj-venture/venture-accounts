import type { AccountOptions } from "#/components/account-selector.tsx";
import { TablePagination } from "#/components/table-pagination.tsx";
import { Alert, AlertDescription } from "#/components/ui/alert.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useTablePageSize } from "#/hooks/use-table-page-size.ts";
import { useRouter } from "@tanstack/react-router";
import { flexRender } from "@tanstack/react-table";
import { getPaginationRowModel, useLegacyTable } from "@tanstack/react-table/legacy";
import { useEffect, useMemo, useState } from "react";
import { getColumns } from "./columns.tsx";
import { postTransaction, type AccountTransaction } from "./transactions-fn.ts";

// Columns that shrink to their contents, leaving the spare width to the
// others. w-px works because table cells can't shrink below their content,
// and TableHead/TableCell are already whitespace-nowrap.
const FIT_CONTENT_COLUMNS = new Set(["account", "actions"]);

function fitContentClass(columnId: string) {
  return FIT_CONTENT_COLUMNS.has(columnId) ? "w-px" : undefined;
}

export function TransactionsTable({
  data,
  accountOptions,
  pageResetKey,
}: {
  data: AccountTransaction[];
  accountOptions: AccountOptions;
  /** Changing this (e.g. when filters change) sends the table back to page 1. */
  pageResetKey?: string;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<ReadonlyMap<number, number>>(new Map());
  // Stored as the exceptions so "Post?" is ticked by default for every row.
  const [unpostedLineIds, setUnpostedLineIds] = useState<ReadonlySet<number>>(new Set());
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      getColumns({
        accountOptions,
        selections,
        savingLineId,
        onSelect: (journalLineId, accountId) =>
          setSelections((previous) => new Map(previous).set(journalLineId, accountId)),
        unpostedLineIds,
        onPostChange: (journalLineId, shouldPost) =>
          setUnpostedLineIds((previous) => {
            const next = new Set(previous);
            if (shouldPost) {
              next.delete(journalLineId);
            } else {
              next.add(journalLineId);
            }
            return next;
          }),
        onSave: async (journalLineId, accountId) => {
          setSavingLineId(journalLineId);
          setSaveError(null);
          try {
            await postTransaction({
              data: { journalLineId, accountId, should_post: !unpostedLineIds.has(journalLineId) },
            });
            setSelections((previous) => {
              const next = new Map(previous);
              next.delete(journalLineId);
              return next;
            });
            // Reload just this page's transactions - the posted one drops
            // off the list. The cached account options stay as they are.
            await router.invalidate({
              filter: (match) => match.routeId === "/books/banking/transactions/$id",
            });
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Couldn't save the transaction.");
          } finally {
            setSavingLineId(null);
          }
        },
      }),
    [accountOptions, selections, unpostedLineIds, savingLineId, router],
  );
  const [pageSize, setPageSize] = useTablePageSize();
  const [requestedPageIndex, setPageIndex] = useState(0);

  // The page-size dropdown lives outside this table (it's shared across
  // every table via useTablePageSize) and can change pageSize without going
  // through onPaginationChange below - reset back to page 1 when that
  // happens so the current pageIndex can't end up out of range. Same for a
  // change of filters, which the parent signals through pageResetKey.
  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, pageResetKey]);

  // Saving reloads data, and posting removes a row - clamp so posting the
  // last row of the last page lands on the new last page, not an empty one.
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);

  const table = useLegacyTable({
    data,
    columns,
    // Key rows by journal line, not index, so a row's selection doesn't
    // shift onto its neighbour when a posted row drops off the list.
    getRowId: (row) => String(row.journalLineId),
    getPaginationRowModel: getPaginationRowModel(),
    // By default any change to data jumps back to page 1 - including the
    // reload after a save. Page resets are handled explicitly above instead.
    autoResetPageIndex: false,
    state: { pagination: { pageIndex, pageSize } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize as typeof pageSize);
    },
  });

  return (
    <>
      {saveError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={fitContentClass(header.column.id)}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={fitContentClass(cell.column.id)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                No transactions yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination table={table} />
    </>
  );
}
