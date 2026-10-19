import { format, parseISO } from "date-fns"
import ExcelJS from "exceljs"
import type { ReportPeriod } from "./report-period.server.ts"

// Server-only: the layout the Excel exports share - company name, report
// title and period over a frozen header row (row 5).

export const MONEY_FORMAT = "#,##0.00"

// "1 Mar 2025 - 28 Feb 2026", or a one-sided / open range in words.
function describePeriod({ from, to }: ReportPeriod) {
  const day = (value: string) => format(parseISO(value), "d MMM yyyy")
  if (from && to) return `${day(from)} - ${day(to)}`
  if (from) return `From ${day(from)}`
  if (to) return `Up to ${day(to)}`
  return "All dates"
}

export function startReportSheet({
  companyName,
  title,
  period,
  columns,
}: {
  companyName: string
  title: string
  period: ReportPeriod
  columns: { key: string; width: number }[]
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = companyName
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(title, { views: [{ state: "frozen", ySplit: 5 }] })
  sheet.columns = columns

  sheet.addRow([companyName]).font = { bold: true, size: 14 }
  sheet.addRow([title]).font = { bold: true, size: 12 }
  sheet.addRow([describePeriod(period)])
  sheet.addRow([])
  return { workbook, sheet }
}

/** The bold, underlined column headings; `rightAligned` are 1-based columns. */
export function addHeaderRow(sheet: ExcelJS.Worksheet, labels: string[], rightAligned: number[]) {
  const header = sheet.addRow(labels)
  header.font = { bold: true }
  header.border = { bottom: { style: "thin" } }
  for (const column of rightAligned) {
    header.getCell(column).alignment = { horizontal: "right" }
  }
  return header
}

// The file for the browser to save, base64-encoded: `baseName`_from_to.xlsx.
export async function toExcelFile(
  workbook: ExcelJS.Workbook,
  baseName: string,
  period: ReportPeriod,
) {
  const buffer = await workbook.xlsx.writeBuffer()
  const dates =
    period.from || period.to ? `_${period.from ?? "start"}_to_${period.to ?? "end"}` : ""
  return {
    fileName: `${baseName}${dates}.xlsx`,
    base64: Buffer.from(buffer).toString("base64"),
  }
}
