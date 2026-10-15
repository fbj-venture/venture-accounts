import { Button } from "#/components/ui/button.tsx"
import type { RowData } from "@tanstack/react-table"
import type { LegacyColumn } from "@tanstack/react-table/legacy"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

// A column header that sorts its table when clicked: ascending, descending,
// then back to the default order. For TanStack Table columns.
export function SortableHeader<TData extends RowData>({
  column,
  title,
}: {
  column: LegacyColumn<TData>
  title: string
}) {
  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon
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
  )
}
