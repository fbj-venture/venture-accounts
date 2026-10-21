import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Progress } from "#/components/ui/progress"
import type { UploadEvent } from "#/routes/api/books/import.ts"
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import { toDisplayLines, toProgressValue } from "./import-events.ts"

// The upload form shared by the PDF importers: pick a file, give it a
// description, and watch the import progress as the server streams it back.
// `layout` tells the server which kind of PDF this is.
export function PdfImportForm({
  layout,
  fileLabel,
  defaultDescription,
  submitLabel,
}: {
  layout: "statement" | "history" | "fnb"
  fileLabel: string
  defaultDescription: string
  submitLabel: string
}) {
  const [events, setEvents] = useState<UploadEvent[]>([])
  const [pending, setPending] = useState(false)

  const finalEvent = events.at(-1)
  const outcome = finalEvent?.phase === "done" || finalEvent?.phase === "error" ? finalEvent : null
  // Hidden until the upload starts; once it's started, stays visible even
  // after it finishes (pending goes back to false at the end).
  const hasStarted = pending || events.length > 0

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setEvents([])
    setPending(true)

    const formData = new FormData(form)
    formData.set("layout", layout)
    // A blank description becomes the default one with the file's name after it.
    const file = formData.get("file")
    if (String(formData.get("description") ?? "").trim() === "") {
      formData.set(
        "description",
        file instanceof File ? `${defaultDescription} (${file.name})` : defaultDescription,
      )
    }
    const response = await fetch("/api/books/import", {
      method: "POST",
      body: formData,
    })

    if (!response.ok || !response.body) {
      setEvents([{ phase: "error", message: await response.text() }])
      setPending(false)
      return
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ""
    let lastEvent: UploadEvent | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += value
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith("data: ")) continue
        const parsedEvent: UploadEvent = JSON.parse(line.slice("data: ".length))
        lastEvent = parsedEvent
        setEvents((previous) => [...previous, parsedEvent])
      }
    }

    setPending(false)
    if (lastEvent?.phase === "done") {
      form.reset()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="file">{fileLabel}</FieldLabel>
          <Input id="file" name="file" type="file" accept="application/pdf,.pdf" required />
          <FieldDescription>PDF documents only.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Input
            id="description"
            name="description"
            type="text"
            placeholder={defaultDescription}
            autoComplete="off"
          />
          <FieldDescription>
            Shown with the document on the bank account&apos;s uploads page. Left blank, it is
            &quot;{defaultDescription} (file name)&quot;.
          </FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading..." : submitLabel}
          </Button>
        </Field>

        {hasStarted ? <Progress value={toProgressValue(events)} /> : null}

        {events.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {toDisplayLines(events).map((line, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : null}

        {outcome ? (
          <Alert variant={outcome.phase === "done" ? "default" : "destructive"}>
            {outcome.phase === "done" ? (
              <CheckCircle2Icon className="size-4" />
            ) : (
              <AlertCircleIcon className="size-4" />
            )}
            <AlertTitle>
              {outcome.phase === "done" ? "Import complete" : "Import failed"}
            </AlertTitle>
            <AlertDescription>
              {outcome.phase === "done"
                ? `Imported ${outcome.imported} of ${outcome.total} transactions (${outcome.skipped} already imported).`
                : outcome.message}
            </AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
    </form>
  )
}
