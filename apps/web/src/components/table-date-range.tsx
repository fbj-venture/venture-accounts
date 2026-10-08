import { currentYear } from "#/lib/dates.ts";
import { Button } from "#/components/ui/button.tsx";
import { Calendar } from "#/components/ui/calendar.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/components/ui/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx";
import { endOfYear, format, startOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";

function formatRangeLabel(range: DateRange | undefined) {
  if (!range?.from) {
    return "Filter by date";
  }
  if (!range.to) {
    return format(range.from, "d MMM yyyy");
  }
  return `${format(range.from, "d MMM yyyy")} - ${format(range.to, "d MMM yyyy")}`;
}

// Generic date-range filter for any table - reused across the app rather
// than living under a single table's -components folder.
export function TableDateRange({
  range,
  onRangeChange,
  years,
}: {
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  /** Years to offer in the quick-select dropdown, spanning the dataset. */
  years: number[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => String(currentYear()));
  // Picking dates/years only edits this draft; the table only re-filters
  // once "Apply" commits it via onRangeChange.
  const [draftRange, setDraftRange] = useState(range);
  // Which month the calendar is showing - kept separate from draftRange so
  // picking a year can move the calendar there even before any day is picked.
  const [month, setMonth] = useState(() => range?.from ?? new Date());

  // Keep the draft in sync with the applied range - covers Clear (which
  // applies immediately) and the popover being reopened later.
  useEffect(() => {
    setDraftRange(range);
    if (range?.from) {
      setMonth(range.from);
    }
  }, [range]);

  function applyYear(year: string) {
    setSelectedYear(year);
    const yearStart = startOfYear(new Date(Number(year), 0, 1));
    setDraftRange({ from: yearStart, to: endOfYear(yearStart) });
    setMonth(yearStart);
  }

  function clear() {
    setDraftRange(undefined);
    onRangeChange(undefined);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="font-normal">
          <CalendarIcon className="size-4" />
          {formatRangeLabel(range)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <Select value={selectedYear} onValueChange={applyYear}>
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue placeholder="Jump to year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clear} disabled={!range?.from}>
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRangeChange(draftRange);
                setOpen(false);
              }}
              disabled={!draftRange?.from}
            >
              Apply
            </Button>
          </div>
        </div>
        <Calendar
          mode="range"
          selected={draftRange}
          onSelect={setDraftRange}
          numberOfMonths={2}
          month={month}
          onMonthChange={setMonth}
        />
      </PopoverContent>
    </Popover>
  );
}
