import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx";

// Drop-down for choosing the ledger account a transaction posts to.
// Stub: no options are loaded yet and the selection isn't stored anywhere.
export function AccountSelect() {
  return (
    <Select>
      <SelectTrigger size="sm" className="w-[200px]" aria-label="Account">
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      {/* popper, not the default item-aligned: item-aligned positions the
          menu over the selected item, so with no items it never opens. */}
      <SelectContent position="popper">
        <div className="px-2 py-1.5 text-sm text-muted-foreground">No accounts yet</div>
      </SelectContent>
    </Select>
  );
}
