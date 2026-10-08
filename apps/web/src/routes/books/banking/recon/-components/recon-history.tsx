import { formatDate } from "#/lib/dates.ts";
import { Button } from "#/components/ui/button.tsx";
import { ButtonGroup } from "#/components/ui/button-group.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { formatZar } from "#/lib/currency.ts";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { getBankUploadUrl } from "../../uploads/-components/uploads-fn.ts";
import {
  getReconDetails,
  listReconHistory,
  setReconUpload,
  type ReconDetails,
  type ReconHistoryItem,
} from "./recon-fn.ts";
import { UploadPickerDialog } from "./upload-picker-dialog.tsx";
import { ReconTransactionsTable } from "./recon-transactions-table.tsx";

const formatDay = (day: string) => format(parseISO(day), "d MMM yyyy");

type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

const errorMessage = (caught: unknown) =>
  caught instanceof Error ? caught.message : "Something went wrong.";

// Previous (balanced) reconciliations of a bank account, newest first. Mounted
// only once the History tab is first opened, so nothing is fetched until then.
// Picking one shows its details, read-only.
export function ReconHistory({ bankAccountId }: { bankAccountId: number }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  return selectedId === null ? (
    <HistoryList bankAccountId={bankAccountId} onSelect={setSelectedId} />
  ) : (
    <HistoryDetails reconId={selectedId} onBack={() => setSelectedId(null)} />
  );
}

function HistoryList({
  bankAccountId,
  onSelect,
}: {
  bankAccountId: number;
  onSelect: (reconId: number) => void;
}) {
  const [state, setState] = useState<Loadable<ReconHistoryItem[]>>({ status: "loading" });
  // The reconciliation the upload picker is open for.
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function patchItem(reconId: number, upload: { id: number; description: string } | null) {
    setState((previous) =>
      previous.status === "ready"
        ? {
            status: "ready",
            data: previous.data.map((item) =>
              item.id === reconId
                ? { ...item, uploadId: upload?.id ?? null, uploadDescription: upload?.description ?? null }
                : item,
            ),
          }
        : previous,
    );
  }

  async function run(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  const link = (reconId: number, upload: { id: number; description: string }) =>
    run(async () => {
      await setReconUpload({ data: { reconId, bankUploadId: upload.id } });
      patchItem(reconId, upload);
    });
  const unlink = (reconId: number) =>
    run(async () => {
      await setReconUpload({ data: { reconId, bankUploadId: null } });
      patchItem(reconId, null);
    });
  const view = (uploadId: number) =>
    run(async () => {
      // Opened straight away so it isn't blocked as a pop-up, then pointed at
      // the link once it's fetched.
      const tab = window.open("", "_blank");
      try {
        const { url } = await getBankUploadUrl({ data: uploadId });
        if (tab) {
          tab.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch (caught) {
        tab?.close();
        throw caught;
      }
    });

  useEffect(() => {
    let cancelled = false;
    listReconHistory({ data: bankAccountId }).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (caught) => !cancelled && setState({ status: "error", message: errorMessage(caught) }),
    );
    return () => {
      cancelled = true;
    };
  }, [bankAccountId]);

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading history...</p>;
  }
  if (state.status === "error") {
    return (
      <p className="text-sm text-destructive" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No reconciliations have been balanced yet.</p>;
  }

  return (
    <>
    {actionError ? (
      <p className="mb-2 text-sm text-destructive" role="alert">
        {actionError}
      </p>
    ) : null}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Statement date</TableHead>
          <TableHead className="text-right">Opening balance</TableHead>
          <TableHead className="text-right">Closing balance</TableHead>
          <TableHead>Balanced on</TableHead>
          <TableHead className="w-px">Statement</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {state.data.map((item) => (
          <TableRow
            key={item.id}
            className="cursor-pointer"
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <TableCell>{formatDay(item.statementDate)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatZar(item.openingBalance)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatZar(item.closingBalance)}</TableCell>
            <TableCell>{formatDate(item.balancedAt)}</TableCell>
            <TableCell onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <ButtonGroup>
                {item.uploadId !== null ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => view(item.uploadId!)}>
                    View
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setLinkingId(item.id)}>
                    Link
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label="Statement actions"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.uploadId !== null ? (
                      <>
                        <DropdownMenuItem onSelect={() => view(item.uploadId!)}>View</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setLinkingId(item.id)}>Change</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => unlink(item.id)}>Unlink</DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onSelect={() => setLinkingId(item.id)}>Link</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <UploadPickerDialog
      bankAccountId={bankAccountId}
      open={linkingId !== null}
      onOpenChange={(open) => !open && setLinkingId(null)}
      onSelect={(upload) => linkingId !== null && link(linkingId, upload)}
    />
    </>
  );
}

function HistoryDetails({ reconId, onBack }: { reconId: number; onBack: () => void }) {
  const [state, setState] = useState<Loadable<ReconDetails | null>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getReconDetails({ data: reconId }).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (caught) => !cancelled && setState({ status: "error", message: errorMessage(caught) }),
    );
    return () => {
      cancelled = true;
    };
  }, [reconId]);

  const back = (
    <Button type="button" variant="ghost" size="sm" className="mb-4" onClick={onBack}>
      <ArrowLeft className="size-4" />
      Back to history
    </Button>
  );

  if (state.status === "loading") {
    return (
      <>
        {back}
        <p className="text-sm text-muted-foreground">Loading reconciliation...</p>
      </>
    );
  }
  if (state.status === "error" || state.data === null) {
    return (
      <>
        {back}
        <p className="text-sm text-destructive" role="alert">
          {state.status === "error" ? state.message : "Reconciliation not found."}
        </p>
      </>
    );
  }

  const { recon, transactions } = state.data;
  return (
    <>
      {back}
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Statement date</dt>
        <dd>{formatDay(recon.statementDate)}</dd>
        <dt className="text-muted-foreground">Opening balance</dt>
        <dd className="tabular-nums">{formatZar(recon.openingBalance)}</dd>
        <dt className="text-muted-foreground">Closing balance</dt>
        <dd className="tabular-nums">{formatZar(recon.closingBalance)}</dd>
      </dl>
      <h3 className="mt-6 pb-2">Reconciled transactions</h3>
      <ReconTransactionsTable
        reconId={recon.id}
        openingBalance={recon.openingBalance}
        closingBalance={recon.closingBalance}
        isBalanced={recon.isBalanced}
        transactions={transactions}
      />
    </>
  );
}
