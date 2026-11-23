import { getVerifiedSession } from "#/lib/auth-session.server.ts"
import { addReceipt } from "#/lib/expense-entry.server.ts"
import { createFileRoute } from "@tanstack/react-router"

// Adds a receipt (a photo or a PDF) to a transaction's bank line (multipart
// form data - see the Receipt column of the banking transactions table).
// Answers 200 with the number of receipts the line now has as JSON, or an
// error status with the reason as text.
export const Route = createFileRoute("/api/books/receipt")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await getVerifiedSession(request.headers)
        if (!session) {
          return new Response("Unauthorized", { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get("file")
        const journalLineId = Number(formData.get("journalLineId"))
        if (!(file instanceof File) || !Number.isInteger(journalLineId) || journalLineId <= 0) {
          return new Response("Choose a file.", { status: 400 })
        }

        try {
          const count = await addReceipt(journalLineId, file, session.user.id)
          return Response.json({ count })
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Couldn't save the file.", {
            status: 400,
          })
        }
      },
    },
  },
})
