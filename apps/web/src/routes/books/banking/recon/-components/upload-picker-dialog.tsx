import { formatDate } from "#/lib/dates.ts";
import { Button } from "#/components/ui/button.tsx";
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
import { format, parseISO } from "date-fns";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listUnlinkedUploads, type UploadSummary } from "./recon-fn.ts";

// "statements/<account number>/2025-01-31.pdf" -> "Jan 2025"; a path that
// doesn't end in a statement date is shown as it is.
const statementMonth = (path: string) => {
  const day = /(\d{4}-\d{2}-\d{2})\.pdf$/.exec(path)?.[1];
  return day ? format(parseISO(day), "MMM yyyy") : path;
};

// "2025-01-31" from a statement path, so months sort chronologically; a path
// without a statement date sorts by the path itself.
const statementDay = (path: string) => /(d{4}-d{2}-d{2}).pdf$/.exec(path)?.[1] ?? path;

type SortKey = "description" | "statement" | "uploaded";
type Sorting = { key: SortKey; direction: "asc" | "desc" } | null;

const sortValues: Record<SortKey, (upload: PickerUpload) => string | number> = {
  description: (upload) => upload.description.toLowerCase(),
  statement: (upload) => statementDay(upload.path),
  uploaded: (upload) => new Date(upload.uploadedAt).getTime(),
};

function SortableHeader({
  title,
  sortKey,
  sorting,
  onSort,
}: {
  title: string;
  sortKey: SortKey;
  sorting: Sorting;
  onSort: (key: SortKey) => void;
}) {
  const direction = sorting?.key === sortKey ? sorting.direction : null;
  const Icon = direction === "asc" ? ArrowUpIcon : direction === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button variant="ghost" size="sm" className="-ml-2.5" onClick={() => onSort(sortKey)}>
      {title}
      <Icon className={direction ? undefined : "text-muted-foreground"} />
    </Button>
  );
}

type PickerUpload = Awaited<ReturnType<typeof listUnlinkedUploads>>[number];

type Uploads = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: PickerUpload[] };

// Lists the bank account's uploads that no reconciliation uses yet, fetched
// each time the dialog opens. Choosing one hands it back and closes.
export function UploadPickerDialog({
  bankAccountId,
  open,
  onOpenChange,
  onSelect,
}: {
  bankAccountId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (upload: UploadSummary) => void;
}) {
  const [uploads, setUploads] = useState<Uploads>({ status: "loading" });
  const [sorting, setSorting] = useState<Sorting>(null);

  // Ascending, then descending, then back to the order they came in.
  const toggleSort = (key: SortKey) =>
    setSorting((previous) =>
      previous?.key !== key
        ? { key, direction: "asc" }
        : previous.direction === "asc"
          ? { key, direction: "desc" }
          : null,
    );

  const rows = useMemo(() => {
    if (uploads.status !== "ready" || !sorting) {
      return uploads.status === "ready" ? uploads.data : [];
    }
    const value = sortValues[sorting.key];
    const sign = sorting.direction === "asc" ? 1 : -1;
    return [...uploads.data].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return (left < right ? -1 : left > right ? 1 : 0) * sign;
    });
  }, [uploads, sorting]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setUploads({ status: "loading" });
    listUnlinkedUploads({ data: bankAccountId }).then(
      (data) => !cancelled && setUploads({ status: "ready", data }),
      (caught) =>
        !cancelled &&
        setUploads({
          status: "error",
          message: caught instanceof Error ? caught.message : "Couldn't load the uploads.",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, bankAccountId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Link an uploaded statement</DialogTitle>
          <DialogDescription>
            Uploads for this account that aren't linked to a reconciliation yet.
          </DialogDescription>
        </DialogHeader>
        {uploads.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading uploads...</p>
        ) : uploads.status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {uploads.message}
          </p>
        ) : uploads.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no unlinked uploads.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader title="Description" sortKey="description" sorting={sorting} onSort={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader title="Statement Month" sortKey="statement" sorting={sorting} onSort={toggleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader title="Uploaded" sortKey="uploaded" sorting={sorting} onSort={toggleSort} />
                  </TableHead>
                  <TableHead className="w-px">
                    <span className="sr-only">Select</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>{upload.description}</TableCell>
                    <TableCell className="break-all text-muted-foreground">{statementMonth(upload.path)}</TableCell>
                    <TableCell>{formatDate(upload.uploadedAt)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onSelect(upload);
                          onOpenChange(false);
                        }}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
