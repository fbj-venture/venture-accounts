import { Button } from "#/components/ui/button.tsx";
import { Checkbox } from "#/components/ui/checkbox.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover.tsx";
import { ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type MultiSelectOption = { value: number; label: string };

// A dropdown of checkable options with a search box, for choosing any number
// of them (including none). The button summarises what's ticked.
export function MultiSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  id?: string;
  options: MultiSelectOption[];
  value: number[];
  onValueChange: (value: number[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");

  const selected = useMemo(() => new Set(value), [value]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, search]);

  const summary =
    value.length === 0
      ? placeholder
      : value.length <= 2
        ? options
            .filter((option) => selected.has(option.value))
            .map((option) => option.label)
            .join(", ")
        : `${value.length} selected`;

  function toggle(optionValue: number, checked: boolean) {
    onValueChange(
      checked ? [...value, optionValue] : value.filter((candidate) => candidate !== optionValue),
    );
  }

  return (
    <Popover onOpenChange={(open) => !open && setSearch("")}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={`justify-between font-normal ${className ?? ""}`}
        >
          <span className={`truncate ${value.length === 0 ? "text-muted-foreground" : ""}`}>
            {summary}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-2" align="start">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-2"
        />
        <div className="max-h-64 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Nothing found.</p>
          ) : (
            visible.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.has(option.value)}
                  onCheckedChange={(checked) => toggle(option.value, checked === true)}
                />
                {option.label}
              </label>
            ))
          )}
        </div>
        {value.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => onValueChange([])}
          >
            Clear selection
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
