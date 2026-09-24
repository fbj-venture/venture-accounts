import type { AccountOptions } from "#/components/account-selector.tsx";
import { TablePagination } from "#/components/table-pagination.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useTablePageSize } from "#/hooks/use-table-page-size.ts";
import { formatZar } from "#/lib/currency.ts";
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

type PendingSave = { accountId: number; shouldPost: boolean };
type SaveError = { transaction: AccountTransaction; message: string };

function withoutKey<V>(map: ReadonlyMap<number, V>, key: number): ReadonlyMap<number, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
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
  // Saves in flight, applied optimistically: the row shows the result
  // straight away and the user can move on while the server catches up.
  const [pendingSaves, setPendingSaves] = useState<ReadonlyMap<number, PendingSave>>(new Map());
  // Failed saves waiting to be shown, one modal at a time.
  const [saveErrors, setSaveErrors] = useState<readonly SaveError[]>([]);

  const savingLineIds = useMemo(() => new Set(pendingSaves.keys()), [pendingSaves]);

  // What the grid shows: server data with pending saves layered on top. A
  // posted row disappears, a saved-but-unposted one shows its new account.
  const visibleData = useMemo(
    () =>
      data.flatMap((transaction) => {
        const pending = pendingSaves.get(transaction.journalLineId);
        if (!pending) {
          return [transaction];
        }
        return pending.shouldPost ? [] : [{ ...transaction, otherAccountId: pending.accountId }];
      }),
    [data, pendingSaves],
  );

  // Reload just this page's transactions. The cached account options stay
  // as they are. sync: without it the router reloads an already-showing
  // page in the background and resolves straight away - before the fresh
  // data lands - so clearing a pending save afterwards would flash the row
  // back to its old state.
  const refreshTransactions = () =>
    router.invalidate({
      filter: (match) => match.routeId === "/books/banking/transactions/$id",
      sync: true,
    });

  const columns = useMemo(
    () =>
      getColumns({
        accountOptions,
        selections,
        savingLineIds,
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
        onSave: async (transaction, accountId) => {
          const { journalLineId } = transaction;
          const shouldPost = !unpostedLineIds.has(journalLineId);

          setPendingSaves((previous) =>
            new Map(previous).set(journalLineId, { accountId, shouldPost }),
          );
          setSelections((previous) => withoutKey(previous, journalLineId));

          try {
            await postTransaction({ data: { journalLineId, accountId, should_post: shouldPost } });
            // Keep the optimistic row until fresh data has arrived, so it
            // doesn't flash back to its old state in between.
            await refreshTransactions();
          } catch (error) {
            // postTransaction runs in a database transaction, so a failure
            // leaves nothing half-saved - drop the optimistic change, explain,
            // and reload the grid from the server.
            setSaveErrors((previous) => [
              ...previous,
              {
                transaction,
                message: error instanceof Error ? error.message : "Couldn't save the transaction.",
              },
            ]);
            void refreshTransactions();
          } finally {
            setPendingSaves((previous) => withoutKey(previous, journalLineId));
          }
        },
      }),
    [accountOptions, selections, unpostedLineIds, savingLineIds, router],
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
  const pageCount = Math.max(1, Math.ceil(visibleData.length / pageSize));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);

  const table = useLegacyTable({
    data: visibleData,
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

  const currentError = saveErrors[0];

  return (
    <>
      <AlertDialog
        open={currentError !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setSaveErrors((previous) => previous.slice(1));
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Couldn't save transaction</AlertDialogTitle>
            <AlertDialogDescription>
              {currentError && (
                <>
                  {currentError.transaction.date.toLocaleDateString("en-ZA")} ·{" "}
                  {currentError.transaction.description ?? currentError.transaction.note} ·{" "}
                  {formatZar(currentError.transaction.amount)}
                  <br />
                  {currentError.message} Nothing was saved, and the table has been refreshed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
