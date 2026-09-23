import { TableDateRange } from "#/components/table-date-range.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { HelpCircleIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

function AmountFilterHelp() {
  return (
    <div className="mt-2 text-sm text-muted-foreground">
      <p>The amount box accepts:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          A plain number, e.g. <code>150</code> - matches that amount exactly.
        </li>
        <li>
          A comparison, e.g. <code>&lt;300</code>, <code>&lt;=300</code>,{" "}
          <code>&gt;50</code>, <code>&gt;=50</code>, <code>=42</code>.
        </li>
        <li>
          A range, written as two numbers either side of an operator, e.g.{" "}
          <code>300 &lt; 500</code> or <code>500 &gt; 300</code> - both mean amounts
          between 300 and 500. Use <code>&lt;=</code> or <code>&gt;=</code> to include
          the endpoints.
        </li>
        <li>
          Multiple expressions combined with <code>&amp;</code>, all of which must
          match, e.g. <code>&gt;100 &amp; &lt;500</code>.
        </li>
      </ul>
    </div>
  );
}

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
            <Input
              id="transaction-amount-filter"
              placeholder="e.g. <300 or >100 & <500"
              value={amountFilter}
              onChange={(event) => onAmountFilterChange(event.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showAmountHelp ? "Hide amount filter help" : "Show amount filter help"}
            aria-pressed={showAmountHelp}
            onClick={() => setShowAmountHelp((shown) => !shown)}
          >
            <HelpCircleIcon className="size-4" />
          </Button>
        </div>
        <TableDateRange range={range} onRangeChange={onRangeChange} years={years} />
      </div>
      {showAmountHelp ? <AmountFilterHelp /> : null}
    </div>
  );
}
