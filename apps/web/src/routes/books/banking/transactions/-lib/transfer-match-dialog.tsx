import { Button } from "#/components/ui/button.tsx";
import { Checkbox } from "#/components/ui/checkbox.tsx";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "#/components/ui/dialog.tsx";
import { formatZar } from "#/lib/currency.ts";
import { formatDate } from "#/lib/dates.ts";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
    findTransferMatches,
    type AccountTransaction,
    type TransferMatches,
} from "../-server/transactions.server.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: TransferMatches };

// Shown a moment after a bank account is picked for a row: looks for the
// other bank's transactions this one could be a Transfer with, and lets the
// user choose which. A transfer pairs with exactly one transaction, so ticking
// one un-ticks the others. A single match starts ticked. Select hands the
// choice back (Save is enabled for the row then); Cancel, closing the dialog
// or finding nothing leaves the row without a transfer account.
//
// Mount it with a key on the row and account, so each lookup starts afresh.
export function TransferMatchDialog({
  transaction,
  accountId,
  onSelect,
  onCancel,
}: {
  transaction: AccountTransaction;
  accountId: number;
  onSelect: (counterpartLineId: number) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [chosenLineId, setChosenLineId] = useState<number | null>(null);

  const { journalLineId } = transaction;
  useEffect(() => {
    let cancelled = false;
    findTransferMatches({ data: { journalLineId, accountId } }).then(
      (result) => {
        if (cancelled) {
          return;
        }
        setState({ status: "ready", result });
        // The only match is the likely answer - start with it ticked.
        if (result.matches.length === 1) {
          setChosenLineId(result.matches[0]!.lineId);
        }
      },
      (caught) =>
        !cancelled &&
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : "Couldn't look for matching transactions.",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [journalLineId, accountId]);

  const result = state.status === "ready" ? state.result : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match this transfer</DialogTitle>
          <DialogDescription>
            {formatDate(transaction.date)} · {transaction.description ?? transaction.note} ·{" "}
            {formatZar(transaction.amount)}
            {result ? ` - choose the matching transaction in ${result.accountName}.` : null}
          </DialogDescription>
        </DialogHeader>

        {state.status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Looking for matching transactions...
          </p>
        ) : state.status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : result && result.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matching transaction found: expected {formatZar(-transaction.amount)} in{" "}
            {result.accountName} between {result.range.from} and {result.range.to}. Check that
            account's statement has been imported and that the amount and date agree.
          </p>
        ) : result ? (
          <ul className="grid gap-1" aria-label="Matching transactions">
            {result.matches.map((match) => (
              <li key={match.lineId}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
                  <Checkbox
                    checked={chosenLineId === match.lineId}
                    onCheckedChange={(checked) => setChosenLineId(checked === true ? match.lineId : null)}
                  />
                  <span className="tabular-nums">{formatDate(match.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{match.description}</span>
                  <span className="tabular-nums">{formatZar(match.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {result && result.matches.length > 0 ? "Cancel" : "Close"}
          </Button>
          {result && result.matches.length > 0 ? (
            <Button type="button" disabled={chosenLineId === null} onClick={() => chosenLineId !== null && onSelect(chosenLineId)}>
              Select
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
