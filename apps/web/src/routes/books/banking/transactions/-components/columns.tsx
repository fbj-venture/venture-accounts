import { AccountSelect } from "#/components/account-select.tsx";
import { Button } from "#/components/ui/button.tsx";
import { formatZar } from "#/lib/currency.ts";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { SaveCheckIcon } from "lucide-react";
import type { AccountTransaction } from "./transactions-fn.ts";

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
    header: () => <div className="text-right">Amount</div>,
    cell: ({ getValue }) => (
      <div className="text-right tabular-nums">{formatZar(getValue<number>())}</div>
    ),
  },
  {
    id: "account",
    header: "Account",
    cell: () => <AccountSelect />,
  },
  {
    id: "actions",
    header: () => null,
    cell: () => (
      <div className="flex justify-end">
        <Button type="button" size="icon-sm" aria-label="Save" disabled>
          <SaveCheckIcon className="size-4" />
        </Button>
      </div>
    ),
  },
];
