import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Progress } from "#/components/ui/progress";
import type { UploadEvent } from "#/routes/api/books/import.ts";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/books/banking/import/")({
  component: RouteComponent,
});

// Collapses a stream of UploadEvents into human-readable lines. Per-row
// "importing" events update the same trailing line in place (there can be
// 50-100+ of them per statement) instead of appending one DOM node each.
function toDisplayLines(events: UploadEvent[]): string[] {
  const lines: string[] = [];

  for (const event of events) {
    switch (event.phase) {
      case "uploaded":
        lines.push(
          `Uploaded ${event.fileName} (${Math.round(event.size / 1024)} KB).`,
        );
        break;
      case "extracting":
        lines.push("Extracting transactions from the PDF...");
        break;
      case "extracted":
        lines.push(
          `Found ${event.rowCount} transaction${event.rowCount === 1 ? "" : "s"} ` +
          `for account ${event.accountNumber}, statement dated ${event.statementDate}.`,
        );
        break;
      case "importing": {
        const text =
          `Importing ${event.index + 1}/${event.total}: ` +
          `${event.status === "skipped" ? "skipped (already imported)" : "imported"} - ` +
          event.transaction.details;
        if (lines.at(-1)?.startsWith("Importing ")) {
          lines[lines.length - 1] = text;
        } else {
          lines.push(text);
        }
        break;
      }
      case "done":
        lines.push(
          `Done - ${event.imported} imported, ${event.skipped} skipped, ${event.total} total.`,
        );
        break;
      case "error":
        lines.push(`Error: ${event.message}`);
        break;
    }
  }

  return lines;
}

// Phases before per-row importing starts don't have a natural 0-100 value
// (there's nothing to count yet), so they get fixed checkpoints; importing
// then scales smoothly across the rest of the bar.
function toProgressValue(events: UploadEvent[]): number {
  const lastEvent = events.at(-1);
  if (!lastEvent) return 0;

  switch (lastEvent.phase) {
    case "uploaded":
      return 5;
    case "extracting":
      return 10;
    case "extracted":
      return 15;
    case "importing":
      return 15 + ((lastEvent.index + 1) / lastEvent.total) * 85;
    case "done":
    case "error":
      return 100;
  }
}

function RouteComponent() {
  const [events, setEvents] = useState<UploadEvent[]>([]);
  const [pending, setPending] = useState(false);

  const finalEvent = events.at(-1);
  const outcome =
    finalEvent?.phase === "done" || finalEvent?.phase === "error"
      ? finalEvent
      : null;
  // Hidden until the upload starts; once it's started, stays visible even
  // after it finishes (pending goes back to false at the end).
  const hasStarted = pending || events.length > 0;

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setEvents([]);
    setPending(true);

    const formData = new FormData(form);
    const response = await fetch("/api/books/import", {
      method: "POST",
      body: formData,
    });

    if (!response.ok || !response.body) {
      setEvents([{ phase: "error", message: await response.text() }]);
      setPending(false);
      return;
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let lastEvent: UploadEvent | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const parsedEvent: UploadEvent = JSON.parse(line.slice("data: ".length));
        lastEvent = parsedEvent;
        setEvents((previous) => [...previous, parsedEvent]);
      }
    }

    setPending(false);
    if (lastEvent?.phase === "done") {
      form.reset();
    }
  }

  return (
    <>
      <h2>Import bank statements</h2>
      <p className='border rounded-lg border-gray-800 p-2.5 bg-gray-300'>
        The import feature only supports Standard Bank PDF
        statements without passwords, currently.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="file">Bank statement</FieldLabel>
            <Input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
            />
            <FieldDescription>PDF documents only.</FieldDescription>
          </Field>

          <Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload statement"}
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
    </>
  );
}
