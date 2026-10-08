import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useEffect, useState } from "react";
import { getTransactionIds, unpostJournal, type TransactionIds } from "./search-fn.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ids: TransactionIds };

// Administrators only: the database ids behind one search result, and the
// option to mark its whole journal entry (every line in it) un-posted.
export function TransactionIdsDialog({
  journalLineId,
  onClose,
  onChanged,
}: {
  /** The clicked row's journal line; the dialog is open while this is set. */
  journalLineId: number | null;
  onClose: () => void;
  /** Called after the entry was changed, so the results can be refreshed. */
  onChanged: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [unposting, setUnposting] = useState(false);
  const [unpostError, setUnpostError] = useState<string | null>(null);

  async function unpost() {
    if (journalLineId === null) {
      return;
    }
    setUnposting(true);
    setUnpostError(null);
    try {
      await unpostJournal({ data: journalLineId });
      onChanged();
      onClose();
    } catch (caught) {
      setUnpostError(caught instanceof Error ? caught.message : "Couldn't un-post the transaction.");
      setConfirming(false);
    } finally {
      setUnposting(false);
    }
  }

  useEffect(() => {
    if (journalLineId === null) {
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    setConfirming(false);
    setUnpostError(null);
    getTransactionIds({ data: journalLineId }).then(
      (ids) => !cancelled && setState({ status: "ready", ids }),
      (caught) =>
        !cancelled &&
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : "Couldn't load the ids.",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [journalLineId]);

  return (
    <Dialog open={journalLineId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Database ids</DialogTitle>
          <DialogDescription>For administrators: the records behind this transaction.</DialogDescription>
        </DialogHeader>
        {state.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : state.status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Journal id</dt>
              <dd className="tabular-nums">{state.ids.journalId}</dd>
              <dt className="text-muted-foreground">Posted</dt>
              <dd>{state.ids.isPosted ? "Yes" : "No"}</dd>
            </dl>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Journal line id</TableHead>
                  <TableHead>Account id</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.ids.lines.map((line) => (
                  <TableRow
                    key={line.journalLineId}
                    data-state={line.journalLineId === state.ids.clickedJournalLineId ? "selected" : undefined}
                  >
                    <TableCell className="tabular-nums">{line.journalLineId}</TableCell>
                    <TableCell className="tabular-nums">{line.accountId}</TableCell>
                    <TableCell>{line.accountName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">The highlighted line is the bank line you clicked.</p>
            {unpostError ? (
              <p className="text-sm text-destructive" role="alert">
                {unpostError}
              </p>
            ) : null}
            {state.ids.isPosted ? (
              <DialogFooter className="items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {state.ids.lines.some((line) => line.isReconciled)
                    ? "Reconciled transactions can't be un-posted - take it out of its reconciliation first."
                    : "Un-posting applies to every line in this journal."}
                </p>
                {confirming ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={unposting} onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" disabled={unposting} onClick={unpost}>
                      {unposting ? "Un-posting..." : "Confirm un-post"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.ids.lines.some((line) => line.isReconciled)}
                    onClick={() => setConfirming(true)}
                  >
                    Mark un-posted
                  </Button>
                )}
              </DialogFooter>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
