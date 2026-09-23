import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readPdfStream } from "@app/bank-statement-importer";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";

const uploadStatementFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const file = data.get("file");

    if (!(file instanceof File)) {
      return { success: false as const, error: "No file was uploaded." };
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { success: false as const, error: "Only PDF documents are supported." };
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const transactions = await readPdfStream(bytes);
      return { success: true as const, count: transactions.length };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to import the statement.",
      };
    }
  });

export const Route = createFileRoute("/books/banking/import/")({
  component: RouteComponent,
});

type UploadResult =
  | { success: true; count: number }
  | { success: false; error: string };

function RouteComponent() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const uploaded = await uploadStatementFn({ data: formData });

    setResult(uploaded);
    setPending(false);

    if (uploaded.success) {
      event.currentTarget.reset();
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

          {result ? (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <AlertCircleIcon className="size-4" />
              )}
              <AlertTitle>
                {result.success ? "Import complete" : "Import failed"}
              </AlertTitle>
              <AlertDescription>
                {result.success
                  ? `Imported ${result.count} transaction${result.count === 1 ? "" : "s"}.`
                  : result.error}
              </AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload statement"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </>
  );
}
