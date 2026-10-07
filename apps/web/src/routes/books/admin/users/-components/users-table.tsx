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
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumn,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, PencilIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { SendVerificationLink } from "./send-verification-link.tsx";
import type { AppUser } from "./users-fn.ts";

function SortableHeader({ column, title }: { column: LegacyColumn<AppUser>; title: string }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5"
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      <Icon className={sorted ? undefined : "text-muted-foreground"} />
    </Button>
  );
}

export function UsersTable({
  data,
  onEdit,
}: {
  data: AppUser[];
  onEdit: (user: AppUser) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<LegacyColumnDef<AppUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
      },
      {
        accessorKey: "email",
        header: ({ column }) => <SortableHeader column={column} title="Email" />,
      },
      {
        accessorKey: "role",
        header: ({ column }) => <SortableHeader column={column} title="Role" />,
        cell: ({ getValue }) => <span className="capitalize">{getValue<string>()}</span>,
      },
      {
        id: "enabled",
        header: ({ column }) => <SortableHeader column={column} title="Enabled" />,
        // A ban with an expiry date lapses on its own - better-auth lifts it
        // at the user's next sign-in - so an expired one counts as enabled.
        accessorFn: (row) => !row.banned || (row.banExpires !== null && row.banExpires <= new Date()),
        cell: ({ getValue }) => <Checkbox checked={getValue<boolean>()} disabled aria-label="Enabled" />,
      },
      {
        accessorKey: "emailVerified",
        header: ({ column }) => <SortableHeader column={column} title="Verified" />,
        cell: ({ row, getValue }) =>
          getValue<boolean>() ? "Yes" : <SendVerificationLink user={row.original} />,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column} title="Created" />,
        cell: ({ getValue }) => getValue<Date>().toLocaleDateString("en-ZA"),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="hover:border-primary hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary"
            onClick={() => onEdit(row.original)}
          >
            <PencilIcon />
            Edit
          </Button>
        ),
      },
    ],
    [onEdit],
  );

  const table = useLegacyTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={header.column.id === "actions" ? "w-px" : undefined}>
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
                <TableCell key={cell.id} className={cell.column.id === "actions" ? "w-px" : undefined}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
              No users yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
