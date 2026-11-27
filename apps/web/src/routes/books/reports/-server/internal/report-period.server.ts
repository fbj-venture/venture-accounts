import { DEFAULT_COMPANY_SETTINGS } from "#/lib/company-settings.ts"
import { company, db, journal } from "@app/db/direct"
import { and, asc, eq, gte, lte } from "drizzle-orm"

// Server-only: shared by the report data loaders.

export type ReportPeriod = {
  /** yyyy-MM-dd, inclusive; either end may be null for no limit. */
  from: string | null
  to: string | null
}

// "yyyy-MM-dd" -> the Date a date column (mode: "date") compares against, on
// the calendar date in UTC so time zones can't shift the day.
export const toDate = (day: string) => new Date(`${day}T00:00:00Z`)

const isDay = (day: string | null) => day === null || /^\d{4}-\d{2}-\d{2}$/.test(day)

// The Account Types whose balance carries from one financial year to the next.
// Income and Expense Accounts start each financial year at nothing.
export const CARRIED_FORWARD_TYPES = ["Asset", "Liability", "Equity"]

// The first day of the financial year that day falls in, "yyyy-MM-dd", given
// the month the year ends in (1-12).
export function financialYearStart(day: string, endMonth: number) {
  const [year, month] = day.split("-").map(Number) as [number, number]
  const startMonth = (endMonth % 12) + 1
  const startYear = month >= startMonth ? year : year - 1
  return `${startYear}-${String(startMonth).padStart(2, "0")}-01`
}

// The start of the financial year (per the company settings) a day falls in.
export async function financialYearStartFor(day: string) {
  if (!isDay(day)) {
    throw new Error("The dates are not valid.")
  }
  const [settings] = await db
    .select({ endMonth: company.financialYearEndMonth })
    .from(company)
    .orderBy(asc(company.id))
    .limit(1)
  return financialYearStart(
    day,
    settings?.endMonth ?? DEFAULT_COMPANY_SETTINGS.financialYearEndMonth,
  )
}

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
