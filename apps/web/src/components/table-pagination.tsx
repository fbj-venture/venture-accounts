import { Button } from "#/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSize,
  useTablePageSize,
} from "#/hooks/use-table-page-size.ts";
// The subset of useLegacyTable's pagination API this control needs -
// narrower than LegacyReactTable<TData> so callers don't have to fight
// table generics just to render pagination controls.
type PaginatedTable = {
  getState: () => { pagination: { pageIndex: number } };
  getPageCount: () => number;
  getCanPreviousPage: () => boolean;
  getCanNextPage: () => boolean;
  previousPage: () => void;
  nextPage: () => void;
};

// Generic pagination bar for any table built with useLegacyTable's
// pagination row model; page size is shared across every table via
// useTablePageSize (localStorage-backed).
export function TablePagination({ table }: { table: PaginatedTable }) {
  const [pageSize, setPageSize] = useTablePageSize();

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value) as TablePageSize)}
        >
          <SelectTrigger size="sm" className="w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
