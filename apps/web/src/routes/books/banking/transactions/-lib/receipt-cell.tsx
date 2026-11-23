import { Button } from "#/components/ui/button.tsx"
import { EXPENSE_IMAGE_TYPES, RECEIPT_PDF_TYPE, receiptProblem } from "#/lib/expense-entry.ts"
import { shrinkImage } from "#/lib/shrink-image.ts"
import { LoaderCircleIcon, PaperclipIcon } from "lucide-react"
import { useRef, useState } from "react"
import type { AccountTransaction } from "../-server/transactions.server.ts"

const ACCEPT = [...EXPENSE_IMAGE_TYPES, RECEIPT_PDF_TYPE].join(",")

// The Receipt column: a button that picks a photo or a PDF and keeps it with
// the transaction. A photo is shrunk first, exactly as when adding an expense
// (see shrinkImage); a PDF is sent as it is. Module-level, with its own
// state, so the columns don't have to change when an upload starts or ends.
export function ReceiptCell({ row }: { row: { original: AccountTransaction } }) {
  const { journalLineId, attachmentCount } = row.original
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The count from this session; until a receipt is added here, the saved one.
  const [added, setAdded] = useState<number | null>(null)
  const count = added ?? attachmentCount

  async function upload(chosen: File) {
    setError(null)
    setUploading(true)
    try {
      const file = await shrinkImage(chosen)
      const problem = receiptProblem(file)
      if (problem) {
        throw new Error(problem)
      }
      const formData = new FormData()
      formData.set("journalLineId", String(journalLineId))
      formData.set("file", file)
      const response = await fetch("/api/books/receipt", { method: "POST", body: formData })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      setAdded(((await response.json()) as { count: number }).count)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't upload the file.")
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) {
            void upload(chosen)
          }
        }}
      />
      {error ? (
        <span className="max-w-40 text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="Upload a receipt"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <PaperclipIcon className="size-4" />
        )}
        {count > 0 ? count : null}
      </Button>
    </div>
  )
}
