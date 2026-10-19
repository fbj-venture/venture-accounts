// The filter rules every report shares, used by the pages and the Excel exports
// alike so the two can't disagree. No server-only imports: the browser uses it
// too.

export type ReportFilters = {
  /** Ticked Account Type ids; none ticked shows every type. */
  typeIds: number[]
  showArchived: boolean
}

/** What an Excel export is asked for: the period plus the filters. */
export type ReportRequest = ReportFilters & {
  /** yyyy-MM-dd, inclusive; either end may be null for no limit. */
  from: string | null
  to: string | null
}

export function filterRows<Row extends { accountTypeId: number; isArchived: boolean }>(
  rows: Row[],
  filters: ReportFilters,
) {
  return rows.filter(
    (row) =>
      (filters.typeIds.length === 0 || filters.typeIds.includes(row.accountTypeId)) &&
      (filters.showArchived || !row.isArchived),
  )
}
