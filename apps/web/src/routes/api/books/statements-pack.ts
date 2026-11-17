import { getVerifiedSession } from "#/lib/auth-session.server.ts"
import { buildStatementsPack } from "#/lib/statements-pack.server.ts"
import { createFileRoute } from "@tanstack/react-router"

// The Statements Pack for a bank account and financial year, as a zip:
// GET /api/books/statements-pack?bankAccountId=1&year=2026. When statements
// are missing it answers 409 with JSON { problem, missing } instead.
export const Route = createFileRoute("/api/books/statements-pack")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getVerifiedSession(request.headers)
        if (!session) {
          return new Response("Unauthorized", { status: 401 })
        }
        const params = new URL(request.url).searchParams
        try {
          const result = await buildStatementsPack(
            Number(params.get("bankAccountId")),
            Number(params.get("year")),
          )
          if (!result.ok) {
            return Response.json(
              { problem: result.problem, missing: result.missing ?? [] },
              { status: result.status },
            )
          }
          return new Response(new Uint8Array(result.zip), {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
              "Cache-Control": "no-store",
            },
          })
        } catch (error) {
          console.error("Statements pack failed", error)
          return Response.json(
            { problem: "Couldn't build the statements pack.", missing: [] },
            { status: 500 },
          )
        }
      },
    },
  },
})
