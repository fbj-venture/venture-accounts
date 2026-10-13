import { SortableHeader } from "#/components/sortable-header.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "#/components/ui/table.tsx";
import { formatDateTime } from "#/lib/dates.ts";
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts";
import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
    getSortedRowModel,
    useLegacyTable,
    type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { format, parseISO } from "date-fns";
import { FileTextIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { loadBankAccount } from "../-server/bank-accounts-cache.ts";
import { EditUploadDescriptionDialog } from "./-lib/edit-upload-description-dialog.tsx";
import { getBankUploads, getBankUploadUrl, type BankUploadRow } from "./-server/uploads.server.ts";

export const Route = createFileRoute("/books/banking/uploads/$id")({
  beforeLoad: async ({ params }) => {
    const bankAccount = await loadBankAccount(params.id);
    if (!bankAccount) {
      throw notFound();
    }
    return { bankAccount };
  },
  loader: async ({ context }) => ({
    uploads: await getBankUploads({ data: context.bankAccount.id }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { bankAccount } = Route.useRouteContext();
  const { uploads } = Route.useLoaderData();
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: `Uploads for ${bankAccount.name}` },
  ]);

  const router = useRouter();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [editing, setEditing] = useState<BankUploadRow | null>(null);
  const [search, setSearch] = useState("");

  // Matched anywhere in the description, ignoring case.
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle === ""
      ? uploads
      : uploads.filter((upload) => upload.description.toLowerCase().includes(needle));
  }, [uploads, search]);
  const [error, setError] = useState<string | null>(null);

  async function openUpload(uploadId: number) {
    setError(null);
    setOpeningId(uploadId);
    // Opened straight away, in response to the click, and pointed at the
    // link once it's fetched - a tab opened after the await would be
    // treated as a pop-up and blocked.
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
      setError(caught instanceof Error ? caught.message : "Couldn't open the document.");
    } finally {
      setOpeningId(null);
    }
  }

  // Starts in the order the server sent: newest upload first.
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<LegacyColumnDef<BankUploadRow>[]>(
    () => [
      {
        accessorKey: "description",
        header: ({ column }) => <SortableHeader column={column} title="Document" />,
        // A link that opens the dialog to edit the description.
        cell: ({ row, getValue }) => (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-left font-medium whitespace-normal"
            onClick={() => setEditing(row.original)}
          >
            {getValue<string>()}
          </Button>
        ),
      },
      {
        id: "uploadedAt",
        header: ({ column }) => <SortableHeader column={column} title="Uploaded" />,
        accessorFn: (row) => new Date(row.uploadedAt).getTime(),
        cell: ({ row }) => formatDateTime(row.original.uploadedAt),
      },
      {
        accessorKey: "uploadedBy",
        header: ({ column }) => <SortableHeader column={column} title="By" />,
      },
      {
        // Sorts by the (first) reconciliation's statement date; the uploads
        // that aren't linked come first when ascending.
        id: "reconciliation",
        header: ({ column }) => <SortableHeader column={column} title="Reconciliation" />,
        accessorFn: (row) => row.recons[0]?.statementDate ?? "",
        cell: ({ row }) =>
          row.original.recons.length === 0 ? (
            <span className="text-muted-foreground">Not linked</span>
          ) : (
            <span className="flex flex-col">
              {row.original.recons.map((recon) => (
                <Link
                  key={recon.id}
                  to="/books/banking/recon/session/$id"
                  params={{ id: String(recon.id) }}
                  className="link"
                >
                  Statement of {format(parseISO(recon.statementDate), "d MMM yyyy")}
                </Link>
              ))}
            </span>
          ),
      },
      {
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            disabled={openingId === row.original.id}
            onClick={() => openUpload(row.original.id)}
          >
            <FileTextIcon />
            {openingId === row.original.id ? "Opening..." : "Open"}
          </Button>
        ),
      },
    ],
    // openUpload only uses state setters, so it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openingId],
  );

  const table = useLegacyTable({
    data: shown,
    columns,
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <>
      <h2 className="pb-2">Uploads for {bankAccount.name}</h2>
      <p className="py-2 text-sm text-muted-foreground">
        Documents imported for this bank account, such as bank statements.
      </p>
      {error && <p role="alert" className="py-2 text-sm text-destructive">{error}</p>}
      {uploads.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing has been uploaded for this bank account yet.</p>
      ) : (
        <>
        <Input
          type="search"
          aria-label="Search uploads"
          placeholder="Search description..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
          className="mt-4 w-[320px]"
        />
        <div className="mt-4 max-w-4xl rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    No uploads match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}
      {editing ? (
        <EditUploadDescriptionDialog
          key={editing.id}
          upload={editing}
          onClose={() => setEditing(null)}
          onSaved={() => router.invalidate({ sync: true })}
        />
      ) : null}
    </>
  );
}
