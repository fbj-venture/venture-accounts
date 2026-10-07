import { AmountFilterHelp, AmountFilterInput } from "#/components/amount-filter-input.tsx";
import { TableDateRange } from "#/components/table-date-range.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

// Generic filter bar for any transaction-style table: description search,
// amount search (with a togglable grammar explainer) on the left, and a
// date-range picker on the right. Reused across the app rather than living
// under a single table's -components folder.
export function TableFilterBar({
  descriptionFilter,
  onDescriptionFilterChange,
  amountFilter,
  onAmountFilterChange,
  range,
  onRangeChange,
  years,
}: {
  descriptionFilter: string;
  onDescriptionFilterChange: (value: string) => void;
  amountFilter: string;
  onAmountFilterChange: (value: string) => void;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  /** Years to offer in the date range's quick-select dropdown. */
  years: number[];
}) {
  const [showAmountHelp, setShowAmountHelp] = useState(false);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transaction-description-filter">Description</Label>
            <Input
              id="transaction-description-filter"
              placeholder="Search description..."
              value={descriptionFilter}
              onChange={(event) => onDescriptionFilterChange(event.target.value)}
              className="w-[200px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transaction-amount-filter">Amount</Label>
            <AmountFilterInput
              id="transaction-amount-filter"
              value={amountFilter}
              onValueChange={onAmountFilterChange}
              helpOpen={showAmountHelp}
              onHelpOpenChange={setShowAmountHelp}
              className="w-[180px]"
            />
          </div>
        </div>
        <TableDateRange range={range} onRangeChange={onRangeChange} years={years} />
      </div>
      {showAmountHelp ? <AmountFilterHelp /> : null}
    </div>
  );
}
