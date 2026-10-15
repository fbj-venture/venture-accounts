import { SortableHeader } from "#/components/sortable-header.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx"
import { Link } from "@tanstack/react-router"
import { flexRender, type SortingState } from "@tanstack/react-table"
import {
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { PencilIcon } from "lucide-react"
import { useMemo, useState } from "react"
import type { BankAccountRow } from "../-server/bank-accounts.server.ts"

// Built once (see the useMemo below): the cells render as components, so
// columns that were rebuilt on every render would remount them each time.
function getColumns(): LegacyColumnDef<BankAccountRow>[] {
  return [
    {
      accessorKey: "bankName",
      header: ({ column }) => <SortableHeader column={column} title="Bank" />,
    },
    {
      accessorKey: "accountNumber",
      header: ({ column }) => <SortableHeader column={column} title="Account number" />,
    },
    {
      accessorKey: "description",
      header: ({ column }) => <SortableHeader column={column} title="Description" />,
    },
    {
      accessorKey: "isArchived",
      header: ({ column }) => <SortableHeader column={column} title="Archived" />,
      cell: ({ getValue }) => (
        <Checkbox checked={getValue<boolean>()} disabled aria-label="Archived" />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm">
          <Link
            to="/books/bank-account/$id"
            params={{ id: String(row.original.id) }}
            aria-label={`Edit ${row.original.fullName}`}
          >
            <PencilIcon />
            Edit
          </Link>
        </Button>
      ),
    },
  ]
}

export function BankAccountsTable({ data }: { data: BankAccountRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "bankName", desc: false },
    { id: "description", desc: false },
  ])

  const columns = useMemo(() => getColumns(), [])

  const table = useLegacyTable({
    data,
    columns,
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  })

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
                No bank accounts.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
