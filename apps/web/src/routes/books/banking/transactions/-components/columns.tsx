import { formatZar } from "#/lib/currency.ts";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import type { AccountTransaction } from "../-transactions.ts";

// @tanstack/react-table v9's native API (useTable + explicit feature slots)
// is far more than a plain listing table needs; the /legacy subpath keeps
// the familiar v8 useReactTable/ColumnDef/flexRender shape for this stub.
export const columns: LegacyColumnDef<AccountTransaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ getValue }) => getValue<Date>().toLocaleDateString("en-ZA"),
  },
  {
    id: "description",
    header: "Description",
    accessorFn: (row) => row.description ?? row.note,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ getValue }) => formatZar(getValue<number>()),
  },
];
