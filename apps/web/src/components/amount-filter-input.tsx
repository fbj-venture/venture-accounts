import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { isValidAmountFilter } from "#/lib/amount-filter.ts";
import { cn } from "#/lib/utils.ts";
import { HelpCircleIcon } from "lucide-react";
import { useState } from "react";

export function AmountFilterHelp() {
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

// A text box for an amount expression (">100 & <500"), with a help toggle.
// Its border shows how the typing is going: normal while empty, red while
// the expression isn't valid (yet), green once it is.
export function AmountFilterInput({
  id,
  value,
  onValueChange,
  className,
  helpOpen,
  onHelpOpenChange,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Width etc. for the text box. */
  className?: string;
  /**
   * Pass both to show the help yourself (render <AmountFilterHelp /> where
   * it fits - e.g. across a whole filter bar); otherwise it opens under the box.
   */
  helpOpen?: boolean;
  onHelpOpenChange?: (open: boolean) => void;
}) {
  const [ownHelpOpen, setOwnHelpOpen] = useState(false);
  const controlled = helpOpen !== undefined && onHelpOpenChange !== undefined;
  const showHelp = controlled ? helpOpen : ownHelpOpen;
  const setShowHelp = controlled ? onHelpOpenChange : setOwnHelpOpen;
  const state = value.trim() === "" ? "empty" : isValidAmountFilter(value) ? "valid" : "invalid";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          placeholder="e.g. <300 or >100 & <500"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={state === "invalid"}
          className={cn(
            className,
            state === "invalid" && "border-destructive focus-visible:ring-destructive/30",
            state === "valid" &&
              "border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/30",
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={showHelp ? "Hide amount filter help" : "Show amount filter help"}
          aria-pressed={showHelp}
          onClick={() => setShowHelp(!showHelp)}
        >
          <HelpCircleIcon className="size-4" />
        </Button>
      </div>
      {showHelp && !controlled ? <AmountFilterHelp /> : null}
    </div>
  );
}
