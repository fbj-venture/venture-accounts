import { Button } from "#/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { formatZar } from "#/lib/currency.ts"
import { formatDate } from "#/lib/dates.ts"
import { format, parseISO } from "date-fns"
import { useState } from "react"
import type { ReconHistoryItem } from "../-server/recon.server.ts"
import { uploadReconStatement } from "../-server/recon-upload.server.ts"

// Uploads a statement PDF and links it to a reconciliation. Only the file is
// stored: nothing is read from it and no transactions are imported.
export function UploadStatementDialog({
  reconciliation,
  open,
  onOpenChange,
  onUploaded,
}: {
  /** The reconciliation the statement is linked to. */
  reconciliation: ReconHistoryItem | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the upload is saved and linked. */
  onUploaded: (reconId: number, upload: { id: number; description: string }) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (pending) {
      return
    }
    if (!next) {
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reconciliation) {
      return
    }
    setError(null)
    setPending(true)
    try {
      const formData = new FormData(event.currentTarget)
      formData.set("reconId", String(reconciliation.id))
      const upload = await uploadReconStatement({ data: formData })
      onUploaded(reconciliation.id, upload)
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a statement</DialogTitle>
          <DialogDescription>
            Uploads a PDF and links it to this reconciliation. The PDF is only stored; nothing is
            imported from it.
          </DialogDescription>
        </DialogHeader>
        {reconciliation ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 text-sm">
            <dt className="text-muted-foreground">Statement ending date</dt>
            <dd>{format(parseISO(reconciliation.statementDate), "d MMM yyyy")}</dd>
            <dt className="text-muted-foreground">Balanced on</dt>
            <dd>{formatDate(reconciliation.balancedAt)}</dd>
            <dt className="text-muted-foreground">Opening balance</dt>
            <dd className="tabular-nums">{formatZar(reconciliation.openingBalance)}</dd>
            <dt className="text-muted-foreground">Closing balance</dt>
            <dd className="tabular-nums">{formatZar(reconciliation.closingBalance)}</dd>
          </dl>
        ) : null}
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="upload-statement-file">Statement</FieldLabel>
              <Input
                id="upload-statement-file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                disabled={pending}
              />
              <FieldDescription>PDF documents only.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="upload-statement-description">Description</FieldLabel>
              <Input
                id="upload-statement-description"
                name="description"
                type="text"
                autoComplete="off"
                placeholder="Statement ending (date) (file name)"
                disabled={pending}
              />
            </Field>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload and link"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
