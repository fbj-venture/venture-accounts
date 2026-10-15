import { getOrCreateSettings } from "#/lib/app-settings.server.ts"
import { currentYear } from "#/lib/dates.ts"
import { requireUser } from "#/lib/require-user.server.ts"
import { db, settings } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"

// Keep ALL database code inside handlers (or in a .server.ts module used only
// from a handler) - see transactions/-components/transactions-fn.ts for why.

// The earliest year a user can start their year lists at.
export const MIN_STARTING_YEAR = 2000

/** Why a starting year isn't acceptable, or null if it is. Shared by the form and the server. */
export function startingYearProblem(year: number): string | null {
  if (!Number.isInteger(year)) {
    return "The starting year must be a whole number."
  }
  if (year < MIN_STARTING_YEAR || year > currentYear()) {
    return `The starting year must be between ${MIN_STARTING_YEAR} and ${currentYear()}.`
  }
  return null
}

// The signed-in user's app_settings row.
export type MySettings = Awaited<ReturnType<typeof getMySettings>>

export const getMySettings = createServerFn({ method: "GET" }).handler(async () => {
  const { id } = await requireUser()
  return await getOrCreateSettings(id)
})

// Saves the signed-in user's settings. Only ever their own row: the user comes
// from the session, never from the request.
export const saveMySettings = createServerFn({ method: "POST" })
  .validator((data: { startingYear: number }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const problem = startingYearProblem(data.startingYear)
    if (problem) {
      throw new Error(problem)
    }
    // Makes sure the row exists first, so a user who never loaded the app
    // before saving still ends up with exactly one.
    await getOrCreateSettings(userId)
    await db
      .update(settings)
      .set({ startingYear: data.startingYear })
      .where(eq(settings.userId, userId))
  })
