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
import { flexRender, type SortingState } from "@tanstack/react-table"
import {
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { ArrowRightIcon, CheckIcon } from "lucide-react"
import { useMemo, useState } from "react"
import type { ImportAccount } from "./accounts-import.ts"

// How an item will be treated by the import.
export type PreviewStatus =
  | { kind: "new" }
  | { kind: "exists" }
  | { kind: "unchecked" }
  | { kind: "error"; text: string }

export type PreviewRow = ImportAccount & {
  id: number
  /** Only the ticked ones are imported. */
  checked: boolean
  status: PreviewStatus
}

const statusText = (status: PreviewStatus) =>
  status.kind === "error"
    ? status.text
    : status.kind === "exists"
      ? "Already exists, skipped"
      : status.kind === "unchecked"
        ? "Not imported"
        : "New"

// Built once (see the useMemo below): the cells render as components, so
// columns that were rebuilt on every render would remount them each time.
function getColumns({
  onToggle,
  onToggleAll,
  onEdit,
}: {
  onToggle: (id: number, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (id: number) => void
}): LegacyColumnDef<PreviewRow>[] {
  return [
    {
      id: "checked",
      header: ({ table }) => {
        const rows = table.getCoreRowModel().rows
        const ticked = rows.filter((row) => row.original.checked).length
        return (
          <Checkbox
            checked={ticked === 0 ? false : ticked === rows.length ? true : "indeterminate"}
            onCheckedChange={(checked) => onToggleAll(checked === true)}
            aria-label="Import all"
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.original.checked}
          onCheckedChange={(checked) => onToggle(row.original.id, checked === true)}
          aria-label={`Import ${row.original.name}`}
        />
      ),
      enableSorting: false,
    },
    {
      // Sorts on "Parent:Child", so a sub-account stays with its parent. Shown
      // as "Parent → Child" with only the account's own name a link, which
      // opens the edit dialog.
      id: "name",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      accessorFn: (row) => (row.parent ? `${row.parent}:${row.name}` : row.name),
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {row.original.parent ? (
            <>
              <span>{row.original.parent}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-label="sub-account" />
            </>
          ) : null}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left whitespace-normal"
            onClick={() => onEdit(row.original.id)}
          >
            {row.original.name.trim() || "(no name)"}
          </Button>
        </span>
      ),
    },
    {
      accessorKey: "accountType",
      header: ({ column }) => <SortableHeader column={column} title="Type" />,
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
      id: "status",
      header: ({ column }) => <SortableHeader column={column} title="Check" />,
      accessorFn: (row) => statusText(row.status),
      cell: ({ row }) =>
        row.original.status.kind === "error" ? (
          <span className="text-sm text-destructive">{row.original.status.text}</span>
        ) : row.original.status.kind === "new" ? (
          <CheckIcon className="size-4 text-muted-foreground" aria-label="New" />
        ) : (
          <span className="text-sm text-muted-foreground">{statusText(row.original.status)}</span>
        ),
    },
  ]
}

// The accounts of the import file, sortable by any column. Every row has a
// tick; only the ticked ones are imported.
export function ImportPreviewTable({
  data,
  onToggle,
  onToggleAll,
  onEdit,
}: {
  data: PreviewRow[]
  onToggle: (id: number, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (id: number) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  // The callbacks are state setters or wrap them, so they never change.
  const columns = useMemo(
    () => getColumns({ onToggle, onToggleAll, onEdit }),
    [onToggle, onToggleAll, onEdit],
  )

  const table = useLegacyTable({
    data,
    columns,
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  })

  return (
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
            <TableRow key={row.id} className={row.original.checked ? undefined : "opacity-60"}>
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
              Nothing left to import.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
