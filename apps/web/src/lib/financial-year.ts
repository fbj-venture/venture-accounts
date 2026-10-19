import { currentMonth, currentYear } from "./dates.ts"

export type FinancialYear = {
  /** The calendar year the financial year ends in; also what names it. */
  endYear: number
  label: string
  from: Date
  to: Date
}

const monthName = new Intl.DateTimeFormat("en-ZA", { month: "short" })

// A financial year is named for the calendar year it ends in: with a February
// year end, "FY2026" is 1 Mar 2025 to 28 Feb 2026.
export function financialYear(endYear: number, endMonth: number): FinancialYear {
  const from = new Date(endMonth === 12 ? endYear : endYear - 1, endMonth % 12, 1)
  const to = new Date(endYear, endMonth, 0)
  const label =
    endMonth === 12
      ? `FY${endYear} (Jan - Dec ${endYear})`
      : `FY${endYear} (${monthName.format(from)} ${from.getFullYear()} - ${monthName.format(to)} ${endYear})`
  return { endYear, label, from, to }
}

/** The financial year that today falls in. */
export function currentFinancialYear(endMonth: number) {
  return financialYear(currentMonth() <= endMonth ? currentYear() : currentYear() + 1, endMonth)
}

// From the one containing January of startingYear up to the current one,
// newest first.
export function financialYears(endMonth: number, startingYear: number): FinancialYear[] {
  const last = Math.max(currentFinancialYear(endMonth).endYear, startingYear)
  return Array.from({ length: last - startingYear + 1 }, (_, index) =>
    financialYear(last - index, endMonth),
  )
}
