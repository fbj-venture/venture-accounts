import { Button } from "#/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { useSetBreadcrumbs } from "#/routes/books/-components/breadcrumbs.ts";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { loadBankAccount } from "../-components/bank-accounts-cache.ts";
import { getBankUploads, getBankUploadUrl } from "./-components/uploads-fn.ts";

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

  const [openingId, setOpeningId] = useState<number | null>(null);
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
        <div className="mt-4 max-w-3xl rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="font-medium">{upload.description}</TableCell>
                  <TableCell>{format(upload.uploadedAt, "d MMM yyyy HH:mm")}</TableCell>
                  <TableCell>{upload.uploadedBy}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={openingId === upload.id}
                      onClick={() => openUpload(upload.id)}
                    >
                      <FileTextIcon />
                      {openingId === upload.id ? "Opening..." : "Open"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
