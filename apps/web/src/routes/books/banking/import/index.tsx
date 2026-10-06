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
import { useSetBreadcrumbs } from "#/routes/books/-components/breadcrumbs.ts";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { useState } from "react";
import { toDisplayLines, toProgressValue } from "./-import-events.ts";

const DEFAULT_DESCRIPTION = "Uploading bank statement";

export const Route = createFileRoute("/books/banking/import/")({
  component: RouteComponent,
});

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Import" }]);

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
      <h2>Import Bank Statements</h2>
      <p className='py-2'>
        The import feature currently only supports uploading Standard 
        Bank statements in PDF format, and without passwords. 
        The bank account number and statement date will be read 
        from the uploaded PDF.
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
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Input
              id="description"
              name="description"
              type="text"
              defaultValue={DEFAULT_DESCRIPTION}
              required
            />
            <FieldDescription>
              Shown with the document on the bank account&apos;s uploads page.
            </FieldDescription>
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
