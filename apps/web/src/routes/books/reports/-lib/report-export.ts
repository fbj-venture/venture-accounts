import { useMutation } from "@tanstack/react-query"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { ReportFilters, ReportRequest } from "./report-rows.ts"

// No range: every posted transaction.
export function toCriteria(range: DateRange | undefined) {
  return {
    from: range?.from ? format(range.from, "yyyy-MM-dd") : null,
    to: range?.from ? format(range.to ?? range.from, "yyyy-MM-dd") : null,
  }
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function saveBase64File(fileName: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Exports what a report's table shows (the applied filters, not the draft
// ones). The file is built on the server from the same data, and `exportFn`
// is that report's export server function.
export function useExcelExport(
  applied: (ReportFilters & { range: DateRange | undefined }) | null,
  exportFn: (request: { data: ReportRequest }) => Promise<{ fileName: string; base64: string }>,
) {
  return useMutation({
    mutationFn: async () => {
      if (!applied) return
      const { fileName, base64 } = await exportFn({
        data: {
          ...toCriteria(applied.range),
          typeIds: applied.typeIds,
          showArchived: applied.showArchived,
        },
      })
      saveBase64File(fileName, base64)
    },
  })
}
