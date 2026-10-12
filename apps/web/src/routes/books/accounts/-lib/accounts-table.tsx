import { SortableHeader } from "#/components/sortable-header.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Checkbox } from "#/components/ui/checkbox.tsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "#/components/ui/table.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
    getSortedRowModel,
    useLegacyTable,
    type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { ArrowRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { AccountRow } from "../-server/accounts.server.ts";
import { accountKeys } from "./accounts-queries.ts";
import { EditBankAccountDialog } from "./edit-bank-account-dialog.tsx";
import { RenameAccountDialog } from "./rename-account-dialog.tsx";

// Built once (see the useMemo below): the cells render as components, so
// columns that were rebuilt on every render would remount them each time.
function getColumns({
  onRename,
  onEditBank,
}: {
  onRename: (account: AccountRow) => void;
  onEditBank: (account: AccountRow) => void;
}): LegacyColumnDef<AccountRow>[] {
  return [
    {
      // Sorts on "Parent:Child" (fullName), so a sub-account stays with its
      // parent. Shown as "Parent → Child" with only the account's own name a
      // link, which opens the rename dialog.
      accessorKey: "fullName",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {row.original.parentName ? (
            <>
              <span>{row.original.parentName}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-label="sub-account" />
            </>
          ) : null}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left whitespace-normal"
            onClick={() => onRename(row.original)}
          >
            {row.original.name}
          </Button>
        </span>
      ),
    },
    {
      accessorKey: "accountType",
      header: ({ column }) => <SortableHeader column={column} title="Type" />,
    },
    {
      id: "description",
      header: ({ column }) => <SortableHeader column={column} title="Description" />,
      accessorFn: (row) => row.description ?? "",
    },
    {
      accessorKey: "isArchived",
      header: ({ column }) => <SortableHeader column={column} title="Archived" />,
      cell: ({ getValue }) => <Checkbox checked={getValue<boolean>()} disabled aria-label="Archived" />,
    },
    {
      id: "bank",
      header: ({ column }) => <SortableHeader column={column} title="Bank account" />,
      // Only the accounts that are real bank accounts have these; the text
      // is a link that opens the bank details dialog.
      accessorFn: (row) => (row.bankName ? `${row.bankName} · ${row.accountNumber}` : ""),
      cell: ({ row, getValue }) =>
        row.original.bankName ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left whitespace-normal"
            onClick={() => onEditBank(row.original)}
          >
            {getValue<string>()}
          </Button>
        ) : null,
    },
  ];
}

export function AccountsTable({ data }: { data: AccountRow[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [renaming, setRenaming] = useState<AccountRow | null>(null);
  const [editingBank, setEditingBank] = useState<AccountRow | null>(null);

  // Resolves once the reloaded list has arrived, so a dialog doesn't close on
  // the old values. The router is refreshed too: the account selectors on the
  // transactions pages are still route-loader data, not queries.
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: accountKeys.all });
    await router.invalidate({ sync: true });
  };

  // The state setters never change, so neither do the columns.
  const columns = useMemo(
    () => getColumns({ onRename: setRenaming, onEditBank: setEditingBank }),
    [],
  );

  const table = useLegacyTable({
    data,
    columns,
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
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
                No accounts yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {renaming ? (
        <RenameAccountDialog
          key={renaming.id}
          account={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={refresh}
        />
      ) : null}
      {editingBank ? (
        <EditBankAccountDialog
          key={editingBank.id}
          account={editingBank}
          onClose={() => setEditingBank(null)}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}
