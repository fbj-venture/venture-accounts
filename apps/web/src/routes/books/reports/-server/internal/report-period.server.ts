import { journal } from "@app/db/direct"
import { and, eq, gte, lte } from "drizzle-orm"

// Server-only: shared by the report data loaders.

export type ReportPeriod = {
  /** yyyy-MM-dd, inclusive; either end may be null for no limit. */
  from: string | null
  to: string | null
}

// "yyyy-MM-dd" -> the Date a date column (mode: "date") compares against, on
// the calendar date in UTC so time zones can't shift the day.
const toDate = (day: string) => new Date(`${day}T00:00:00Z`)

const isDay = (day: string | null) => day === null || /^\d{4}-\d{2}-\d{2}$/.test(day)

// The condition for a Journal Entry being posted and dated within the period.
// Only posted Transactions count: an imported one that hasn't been
// categorised and posted yet isn't part of the books.
export function postedInPeriod(period: ReportPeriod) {
  if (!isDay(period.from) || !isDay(period.to)) {
    throw new Error("The dates are not valid.")
  }
  return and(
    eq(journal.isPosted, true),
    period.from ? gte(journal.date, toDate(period.from)) : undefined,
    period.to ? lte(journal.date, toDate(period.to)) : undefined,
  )
}
