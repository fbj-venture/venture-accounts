import { getCompanyName } from "#/lib/company-name.server.ts"
import { requireUser } from "#/lib/require-user.server.ts"
import { createServerFn } from "@tanstack/react-start"
import type { ReportRequest } from "../../-lib/report-rows.ts"
import {
  MONEY_FORMAT,
  addHeaderRow,
  startReportSheet,
  toExcelFile,
} from "../../-server/internal/excel-report.server.ts"
import { buildLedger, describeLine } from "../-lib/general-ledger-rows.ts"
import { loadGeneralLedger } from "./internal/general-ledger-data.server.ts"

// A balance reads as a debit when positive and a credit when negative.
const BALANCE_FORMAT = '#,##0.00" Dr";#,##0.00" Cr"'

// The General Ledger as an .xlsx file, returned base64-encoded for the browser
// to save: the same Accounts, lines, filters and totals as the page (see
// ../-lib/general-ledger-rows.ts), under the company name and the period. The
// running balances and each Account's totals are live formulas, so they follow
// any edit made in the spreadsheet.
export const exportGeneralLedgerToExcel = createServerFn({ method: "POST" })
  .validator((data: ReportRequest) => data)
  .handler(async ({ data }) => {
    await requireUser()
    const [companyName, lines] = await Promise.all([getCompanyName(), loadGeneralLedger(data)])
    const ledger = buildLedger(lines, data)

    const { workbook, sheet } = startReportSheet({
      companyName,
      title: "General Ledger",
      period: data,
      columns: [
        { key: "date", width: 12 },
        { key: "description", width: 60 },
        { key: "debit", width: 16 },
        { key: "credit", width: 16 },
        { key: "balance", width: 18 },
      ],
    })
    addHeaderRow(sheet, ["Date", "Description", "Debit", "Credit", "Balance"], [3, 4, 5])

    for (const section of ledger) {
      const heading = sheet.addRow([
        `${section.isArchived ? `${section.fullName} (archived)` : section.fullName} - ${section.accountType}`,
      ])
      heading.font = { bold: true }
      for (let column = 1; column <= 5; column++) {
        heading.getCell(column).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        }
      }

      let firstLine = 0
      let previous = 0
      for (const entry of section.entries) {
        const row = sheet.addRow([entry.date, describeLine(entry), null, null, null])
        const n = row.number
        firstLine ||= n
        row.getCell(1).numFmt = "yyyy-mm-dd"
        row.getCell(1).alignment = { horizontal: "left" }
        row.getCell(3).value = entry.debit || null
        row.getCell(4).value = entry.credit || null
        row.getCell(5).value = {
          formula: previous ? `E${previous}+C${n}-D${n}` : `C${n}-D${n}`,
          result: entry.balance,
        }
        previous = n
      }

      const t = previous + 1
      const total = sheet.addRow([
        `Total ${section.fullName}`,
        null,
        { formula: `SUM(C${firstLine}:C${t - 1})`, result: section.debits },
        { formula: `SUM(D${firstLine}:D${t - 1})`, result: section.credits },
        { formula: `C${t}-D${t}`, result: section.balance },
      ])
      total.font = { bold: true }
      total.border = { top: { style: "thin" }, bottom: { style: "double" } }
      sheet.addRow([])
    }

    sheet.getColumn("debit").numFmt = MONEY_FORMAT
    sheet.getColumn("credit").numFmt = MONEY_FORMAT
    sheet.getColumn("balance").numFmt = BALANCE_FORMAT

    return await toExcelFile(workbook, "general-ledger", data)
  })
