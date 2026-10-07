import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useEffect, useState } from "react";
import { getTransactionIds, type TransactionIds } from "./search-fn.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ids: TransactionIds };

// Administrators only: the database ids behind one search result.
export function TransactionIdsDialog({
  journalLineId,
  onClose,
}: {
  /** The clicked row's journal line; the dialog is open while this is set. */
  journalLineId: number | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (journalLineId === null) {
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
