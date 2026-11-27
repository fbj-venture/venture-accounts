import { SearchInput } from "#/components/search-input.tsx"
import { SortableHeader } from "#/components/sortable-header.tsx"
import { ButtonGroup } from "#/components/ui/button-group.tsx"
import { Button } from "#/components/ui/button.tsx"
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
import { formatDate } from "#/lib/dates.ts"
import { format, parseISO } from "date-fns"
import { flexRender, type SortingState } from "@tanstack/react-table"
import {
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { getBankUploadUrl } from "../../uploads/-server/uploads.server.ts"
import { ReconTransactionsTable } from "./recon-transactions-table.tsx"
import {
  getReconDetails,
  listReconHistory,
  setReconUpload,
  type ReconDetails,
  type ReconHistoryItem,
} from "../-server/recon.server.ts"
import { UploadPickerDialog } from "./upload-picker-dialog.tsx"
import { UploadStatementDialog } from "./upload-statement-dialog.tsx"

const formatDay = (day: string) => format(parseISO(day), "d MMM yyyy")

type Loadable<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T }

const NO_ITEMS: ReconHistoryItem[] = []

const RIGHT = "text-right tabular-nums"

// Module level so the columns keep a stable identity across renders. The
// statement column is rendered by hand (it has actions), so it only needs a
// header here.
const historyColumns: LegacyColumnDef<ReconHistoryItem>[] = [
  {
    accessorKey: "statementDate",
    header: ({ column }) => <SortableHeader column={column} title="Statement date" />,
    cell: ({ row }) => formatDay(row.original.statementDate),
  },
  {
    accessorKey: "openingBalance",
    header: ({ column }) => <SortableHeader column={column} title="Opening balance" />,
    cell: ({ row }) => formatZar(row.original.openingBalance),
    meta: { className: RIGHT },
  },
  {
    accessorKey: "closingBalance",
    header: ({ column }) => <SortableHeader column={column} title="Closing balance" />,
    cell: ({ row }) => formatZar(row.original.closingBalance),
    meta: { className: RIGHT },
  },
  {
    accessorKey: "balancedAt",
    header: ({ column }) => <SortableHeader column={column} title="Balanced on" />,
    cell: ({ row }) => formatDate(row.original.balancedAt),
  },
  {
    id: "statement",
    header: "Statement",
    enableSorting: false,
    meta: { className: "w-px" },
  },
]

const columnClass = (column: { columnDef: { meta?: unknown } }) =>
  (column.columnDef.meta as { className?: string } | undefined)?.className

const errorMessage = (caught: unknown) =>
  caught instanceof Error ? caught.message : "Something went wrong."

// Previous (balanced) reconciliations of a bank account, newest first. Mounted
// only once the History tab is first opened, so nothing is fetched until then.
// Picking one shows its details, read-only.
export function ReconHistory({ bankAccountId }: { bankAccountId: number }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  return selectedId === null ? (
    <HistoryList bankAccountId={bankAccountId} onSelect={setSelectedId} />
  ) : (
    <HistoryDetails reconId={selectedId} onBack={() => setSelectedId(null)} />
  )
}

function HistoryList({
  bankAccountId,
  onSelect,
}: {
  bankAccountId: number
  onSelect: (reconId: number) => void
}) {
  const [state, setState] = useState<Loadable<ReconHistoryItem[]>>({ status: "loading" })
  // The reconciliation the upload picker is open for.
  const [linkingId, setLinkingId] = useState<number | null>(null)
  // The reconciliation the upload-a-new-statement dialog is open for.
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Newest statement first until the user picks another column.
  const [sorting, setSorting] = useState<SortingState>([{ id: "statementDate", desc: true }])

  const [search, setSearch] = useState("")
  const items = state.status === "ready" ? state.data : NO_ITEMS
  // Matches what the table shows (dates and amounts as formatted) plus the
  // linked statement's description.
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === "") {
      return items
    }
    return items.filter((item) =>
      [
        formatDay(item.statementDate),
        formatZar(item.openingBalance),
        formatZar(item.closingBalance),
        formatDate(item.balancedAt),
        item.uploadDescription ?? "",
      ].some((text) => text.toLowerCase().includes(needle)),
    )
  }, [items, search])

  const table = useLegacyTable({
    data: shown,
    columns: historyColumns,
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  })

  function patchItem(reconId: number, upload: { id: number; description: string } | null) {
    setState((previous) =>
      previous.status === "ready"
        ? {
            status: "ready",
            data: previous.data.map((item) =>
              item.id === reconId
                ? {
                    ...item,
                    uploadId: upload?.id ?? null,
                    uploadDescription: upload?.description ?? null,
                  }
                : item,
            ),
          }
        : previous,
    )
  }

  async function run(action: () => Promise<void>) {
    setActionError(null)
    try {
      await action()
    } catch (caught) {
      setActionError(errorMessage(caught))
    }
  }

  const link = (reconId: number, upload: { id: number; description: string }) =>
    run(async () => {
      await setReconUpload({ data: { reconId, bankUploadId: upload.id } })
      patchItem(reconId, upload)
    })
  const unlink = (reconId: number) =>
    run(async () => {
      await setReconUpload({ data: { reconId, bankUploadId: null } })
      patchItem(reconId, null)
    })
  const view = (uploadId: number) =>
    run(async () => {
      // Opened straight away so it isn't blocked as a pop-up, then pointed at
      // the link once it's fetched.
      const tab = window.open("", "_blank")
      try {
        const { url } = await getBankUploadUrl({ data: uploadId })
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

  useEffect(() => {
    let cancelled = false
    listReconHistory({ data: bankAccountId }).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (caught) => !cancelled && setState({ status: "error", message: errorMessage(caught) }),
    )
    return () => {
      cancelled = true
    }
  }, [bankAccountId])

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading history...</p>
  }
  if (state.status === "error") {
    return (
      <p className="text-sm text-destructive" role="alert">
        {state.message}
      </p>
    )
  }
  if (state.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No reconciliations have been balanced yet.</p>
    )
  }

  return (
    <>
      {actionError ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      <SearchInput
        aria-label="Filter reconciliation history"
        placeholder="Filter by date, balance or statement..."
        value={search}
        onValueChange={setSearch}
        className="mb-3 w-xs"
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={columnClass(header.column)}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={historyColumns.length} className="text-muted-foreground">
                No reconciliations match your filter.
              </TableCell>
            </TableRow>
          ) : null}
          {table.getRowModel().rows.map((row) => {
            const item = row.original
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(item.id)
                  }
                }}
              >
                {row
                  .getVisibleCells()
                  .filter((cell) => cell.column.id !== "statement")
                  .map((cell) => (
                    <TableCell key={cell.id} className={columnClass(cell.column)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                <TableCell
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <ButtonGroup>
                    {item.uploadId !== null ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => view(item.uploadId!)}
                      >
                        View
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLinkingId(item.id)}
                      >
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
                            <DropdownMenuItem onSelect={() => view(item.uploadId!)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setLinkingId(item.id)}>
                              Change
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => unlink(item.id)}>
                              Unlink
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onSelect={() => setLinkingId(item.id)}>
                              Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setUploadingId(item.id)}>
                              Upload
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ButtonGroup>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <UploadStatementDialog
        reconciliation={items.find((item) => item.id === uploadingId)}
        open={uploadingId !== null}
        onOpenChange={(open) => !open && setUploadingId(null)}
        onUploaded={patchItem}
      />
      <UploadPickerDialog
        bankAccountId={bankAccountId}
        reconciliation={items.find((item) => item.id === linkingId)}
        open={linkingId !== null}
        onOpenChange={(open) => !open && setLinkingId(null)}
        onSelect={(upload) => linkingId !== null && link(linkingId, upload)}
      />
    </>
  )
}

function HistoryDetails({ reconId, onBack }: { reconId: number; onBack: () => void }) {
  const [state, setState] = useState<Loadable<ReconDetails | null>>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    getReconDetails({ data: reconId }).then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (caught) => !cancelled && setState({ status: "error", message: errorMessage(caught) }),
    )
    return () => {
      cancelled = true
    }
  }, [reconId])

  const back = (
    <Button type="button" variant="ghost" size="sm" className="mb-4" onClick={onBack}>
      <ArrowLeft className="size-4" />
      Back to history
    </Button>
  )

  if (state.status === "loading") {
    return (
      <>
        {back}
        <p className="text-sm text-muted-foreground">Loading reconciliation...</p>
      </>
    )
  }
  if (state.status === "error" || state.data === null) {
    return (
      <>
        {back}
        <p className="text-sm text-destructive" role="alert">
          {state.status === "error" ? state.message : "Reconciliation not found."}
        </p>
      </>
    )
  }

  const { recon, transactions } = state.data
  return (
    <>
      {back}
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Statement ending date</dt>
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
  )
}
