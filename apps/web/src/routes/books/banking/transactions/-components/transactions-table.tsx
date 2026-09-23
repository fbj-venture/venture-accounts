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
import { flexRender } from "@tanstack/react-table";
import { getPaginationRowModel, useLegacyTable } from "@tanstack/react-table/legacy";
import { useEffect, useState } from "react";
import type { AccountTransaction } from "../-transactions.ts";
import { columns } from "./columns.tsx";

export function TransactionsTable({ data }: { data: AccountTransaction[] }) {
  const [pageSize, setPageSize] = useTablePageSize();
  const [pageIndex, setPageIndex] = useState(0);

  // The page-size dropdown lives outside this table (it's shared across
  // every table via useTablePageSize) and can change pageSize without going
  // through onPaginationChange below - reset back to page 1 when that
  // happens so the current pageIndex can't end up out of range.
  useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);

  const table = useLegacyTable({
    data,
    columns,
    getPaginationRowModel: getPaginationRowModel(),
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                  <TableCell key={cell.id}>
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
