import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog.tsx"
import { formatDate } from "#/lib/dates.ts"
import { Button } from "#/components/ui/button.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx"
import { formatZar } from "#/lib/currency.ts"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDownIcon, EyeIcon, SaveIcon, XIcon } from "lucide-react"
import { useMemo, useState } from "react"
import {
  getReceiptUrl,
  markReconBalanced,
  saveReconLines,
  type ReconDetails,
} from "../-server/recon.server.ts"

type Receipt = ReconDetails["transactions"][number]["attachments"][number]

// The View button of a transaction that has receipts: one opens straight away,
// several offer a choice by file name.
function ReceiptView({
  receipts,
  onOpen,
}: {
  receipts: Receipt[]
  onOpen: (receipt: Receipt) => void
}) {
  const [first] = receipts
  if (!first) {
    return null
  }
  const view = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={receipts.length === 1 ? `View receipt ${first.fileName}` : "View receipt"}
      onClick={() => receipts.length === 1 && onOpen(first)}
    >
      <EyeIcon className="size-4" />
      View
      {receipts.length > 1 ? <ChevronDownIcon className="size-4" /> : null}
    </Button>
  )
  if (receipts.length === 1) {
    return view
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{view}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {receipts.map((receipt) => (
          <DropdownMenuItem key={receipt.id} onSelect={() => onOpen(receipt)}>
            {receipt.fileName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id))

// Every line starts ticked (see `included` below). Ticking a line includes it in the running total, which starts from the
// statement's opening balance (shown as the first row) and adds each ticked
// line in date order - so a ticked row shows the balance as at that line.
// Unticked lines are skipped (their total cell is blank).
//
// Save marks the ticked lines as reconciled against this reconciliation (and
// releases any it held that are now unticked). Balanced does the same and
// then closes the reconciliation, and is only available when the total
// reaches the statement's closing balance.
export function ReconTransactionsTable({
  reconId,
  openingBalance,
  closingBalance,
  isBalanced,
  hasUpload = true,
  unlinkedUploadCount = 0,
  transactions,
}: {
  reconId: number
  openingBalance: number
  closingBalance: number
  isBalanced: boolean
  /** Whether an uploaded statement is linked to this reconciliation. */
  hasUpload?: boolean
  /** How many of the account's uploaded statements are not linked to any reconciliation. */
  unlinkedUploadCount?: number
  transactions: ReconDetails["transactions"]
}) {
  const navigate = useNavigate()
  // What the server holds, to know whether there is anything to save.
  const [saved, setSaved] = useState<ReadonlySet<number>>(
    () => new Set(transactions.filter((t) => t.included).map((t) => t.journalLineId)),
  )
  // Everything starts ticked, since most lines are expected to be on the
  // statement - unless a selection was saved earlier, which wins. A fresh
  // reconciliation therefore starts unsaved, so it can be saved as it stands.
  const [included, setIncluded] = useState<ReadonlySet<number>>(() =>
    saved.size > 0 || isBalanced ? saved : new Set(transactions.map((t) => t.journalLineId)),
  )
  const [busy, setBusy] = useState(false)
  // The "no statement linked" warning, asked before balancing.
  const [confirmingNoUpload, setConfirmingNoUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Work in cents so float noise can't build up down a long list.
  const { runningTotals, totalCents } = useMemo(() => {
    const totals = new Map<number, number>()
    let cents = Math.round(openingBalance * 100)
    for (const transaction of transactions) {
      if (included.has(transaction.journalLineId)) {
        cents += Math.round(transaction.amount * 100)
        totals.set(transaction.journalLineId, cents / 100)
      }
    }
    return { runningTotals: totals, totalCents: cents }
  }, [openingBalance, transactions, included])

  // What's still needed to reach the statement's closing balance.
  const differenceCents = Math.round(closingBalance * 100) - totalCents
  const reachesClosingBalance = differenceCents === 0
  const canSave = !isBalanced && !busy && !sameSet(included, saved)
  const canBalance = !isBalanced && !busy && reachesClosingBalance

  function toggle(journalLineId: number, checked: boolean) {
    setIncluded((previous) => {
      const next = new Set(previous)
      if (checked) {
        next.add(journalLineId)
      } else {
        next.delete(journalLineId)
      }
      return next
    })
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the reconciliation.")
    } finally {
      setBusy(false)
    }
  }

  // Only when some line has a receipt, so the column doesn't sit empty.
  const hasReceipts = transactions.some((transaction) => transaction.attachments.length > 0)
  const columnCount = hasReceipts ? 6 : 5

  function openReceipt(receipt: Receipt) {
    return run(async () => {
      // Opened straight away so it isn't blocked as a pop-up, then pointed at
      // the link once it's fetched.
      const tab = window.open("", "_blank")
      try {
        const { url } = await getReceiptUrl({ data: receipt.id })
        if (tab) {
          tab.location.href = url
        } else {
          window.location.href = url
        }
      } catch (caught) {
        tab?.close()
        throw caught
      }
    })
  }

  const markBalanced = () =>
    run(async () => {
      await markReconBalanced({ data: selection() })
      await navigate({ to: "/books/banking/recon" })
    })

  const selection = () => ({ reconId, includedLineIds: [...included] })

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-px">
              <span className="sr-only">Include in running total</span>
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Running total</TableHead>
            {hasReceipts ? <TableHead className="w-px">Receipt</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/30 font-medium hover:bg-muted/30">
            <TableCell />
            <TableCell />
            <TableCell>Opening balance</TableCell>
            <TableCell />
            <TableCell className="text-right tabular-nums">{formatZar(openingBalance)}</TableCell>
            {hasReceipts ? <TableCell /> : null}
          </TableRow>
          {transactions.length ? (
            transactions.map((transaction) => {
              const runningTotal = runningTotals.get(transaction.journalLineId)
              return (
                <TableRow
                  key={transaction.journalLineId}
                  data-state={runningTotal !== undefined ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={runningTotal !== undefined}
                      disabled={isBalanced || busy}
                      onCheckedChange={(checked) =>
                        toggle(transaction.journalLineId, checked === true)
                      }
                      aria-label={`Include ${transaction.description} in the running total`}
                    />
                  </TableCell>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatZar(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {runningTotal !== undefined ? formatZar(runningTotal) : ""}
                  </TableCell>
                  {hasReceipts ? (
                    <TableCell>
                      <ReceiptView receipts={transaction.attachments} onOpen={openReceipt} />
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                Nothing left to reconcile up to this date.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {error ? (
        <p className="mt-4 text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {isBalanced ? (
        <p className="mt-4 text-right text-sm text-muted-foreground">
          This reconciliation is balanced.
        </p>
      ) : (
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canSave}
              onClick={() =>
                run(async () => {
                  await saveReconLines({ data: selection() })
                  setSaved(included)
                })
              }
            >
              <SaveIcon />
              Save for later
            </Button>
            {/* Leaves without saving: the ticks made on this page are dropped. */}
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => navigate({ to: "/books/banking/recon" })}
            >
              <XIcon />
              Cancel
            </Button>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm tabular-nums">
              <span className="text-muted-foreground">Difference: </span>
              <span className={reachesClosingBalance ? undefined : "font-medium text-destructive"}>
                {formatZar(differenceCents / 100)}
              </span>
            </p>
            <Button
              type="button"
              disabled={!canBalance}
              onClick={() => (hasUpload ? markBalanced() : setConfirmingNoUpload(true))}
            >
              Mark as Balanced
            </Button>
            {hasUpload ? null : (
              <p className="max-w-sm text-right text-sm text-amber-600 dark:text-amber-400">
                No uploaded statement is linked to this reconciliation.
                {unlinkedUploadCount > 0
                  ? ` ${unlinkedUploadCount} uploaded statement${unlinkedUploadCount === 1 ? " is" : "s are"} waiting to be linked.`
                  : ""}
              </p>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={confirmingNoUpload} onOpenChange={setConfirmingNoUpload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Balance without a statement?</AlertDialogTitle>
            <AlertDialogDescription>
              No uploaded statement is linked to this reconciliation.
              {unlinkedUploadCount > 0
                ? ` ${unlinkedUploadCount} uploaded statement${unlinkedUploadCount === 1 ? " is" : "s are"} waiting to be linked - go back and link the right one (use Cancel, then reopen New Recon) so it isn't left unlinked or tied to a second reconciliation.`
                : " You can still link one later from the History tab."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => void markBalanced()}>
              Balance anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
