import { getVerifiedSession } from "#/lib/auth-session.server.ts"
import { addExpense } from "#/lib/expense-entry.server.ts"
import { createFileRoute } from "@tanstack/react-router"

// Adds an expense with the photo of its receipt (multipart form data - see
// routes/books/expense/new.tsx). Answers 200 with the new entry's id as JSON,
// or an error status with the reason as text.
export const Route = createFileRoute("/api/books/expense")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await getVerifiedSession(request.headers)
        if (!session) {
          return new Response("Unauthorized", { status: 401 })
        }

        const formData = await request.formData()
        const photo = formData.get("photo")
        if (!(photo instanceof File)) {
          return new Response("Add a photo.", { status: 400 })
        }
        const text = (name: string) => {
          const value = formData.get(name)
          return typeof value === "string" ? value.trim() : ""
        }

        try {
          const journalId = await addExpense(
            {
              bankAccountId: Number(text("bankAccountId")),
              expenseAccountId: Number(text("expenseAccountId")),
              date: text("date"),
              description: text("description"),
              amount: text("amount") === "" ? NaN : Number(text("amount")),
              photo,
            },
            session.user.id,
          )
          return Response.json({ journalId })
        } catch (error) {
          return new Response(
            error instanceof Error ? error.message : "Couldn't save the expense.",
            {
              status: 400,
            },
          )
        }
      },
    },
  },
})
