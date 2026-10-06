import { readPdfStreamWithProgress, type ImportEvent } from "@app/bank-statement-importer";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth.ts";

// One event per phase, streamed to the client as Server-Sent Events so the
// upload UI can show progress as it happens (upload received, extracting,
// extracted, then one event per row as it's imported) rather than waiting
// for the whole pipeline to finish before showing anything.
export type UploadEvent =
  | { phase: "uploaded"; fileName: string; size: number }
  | ImportEvent
  | { phase: "error"; message: string };

export const Route = createFileRoute("/api/books/import")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return new Response("Unauthorized", { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file");
        const rawDescription = formData.get("description");
        const description =
          typeof rawDescription === "string" ? rawDescription.trim() : "";

        if (!(file instanceof File)) {
          return new Response("No file was uploaded.", { status: 400 });
        }

        if (
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          return new Response("Only PDF documents are supported.", {
            status: 400,
          });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            function send(event: UploadEvent) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
              );
            }

            send({ phase: "uploaded", fileName: file.name, size: file.size });

            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              await readPdfStreamWithProgress(bytes, session.user.id, send, {
                description: description || undefined,
              });
            } catch (error) {
              send({
                phase: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to import the statement.",
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
