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
import { useEffect, useState } from "react";
import { listUnlinkedUploads, type UploadSummary } from "./recon-fn.ts";

// "statements/<account number>/2025-01-31.pdf" -> "Jan 2025"; a path that
// doesn't end in a statement date is shown as it is.
const statementMonth = (path: string) => {
  const day = /(\d{4}-\d{2}-\d{2})\.pdf$/.exec(path)?.[1];
  return day ? format(parseISO(day), "MMM yyyy") : path;
};

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
                  <TableHead>Description</TableHead>
                  <TableHead>Statement Month</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-px">
                    <span className="sr-only">Select</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.data.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>{upload.description}</TableCell>
                    <TableCell className="break-all text-muted-foreground">{statementMonth(upload.path)}</TableCell>
                    <TableCell>{new Date(upload.uploadedAt).toLocaleDateString("en-ZA")}</TableCell>
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
