import { getCompanyName } from "#/lib/company-name.server.ts"
import { requireUser } from "#/lib/require-user.server.ts"
import { createServerFn } from "@tanstack/react-start"
import { filterRows, type ReportRequest } from "../../-lib/report-rows.ts"
import {
  MONEY_FORMAT,
  addHeaderRow,
  startReportSheet,
  toExcelFile,
} from "../../-server/internal/excel-report.server.ts"
import { totalRows } from "../-lib/trial-balance-rows.ts"
import { loadTrialBalance } from "./internal/trial-balance-data.server.ts"

// The Trial Balance as an .xlsx file, returned base64-encoded for the browser
// to save: the same rows, filters and totals as the page (see
// ../-lib/trial-balance-rows.ts), under the company name and the period. The
// Total row is a live SUM, so it follows any edit made in the spreadsheet.
export const exportTrialBalanceToExcel = createServerFn({ method: "POST" })
  .validator((data: ReportRequest) => data)
  .handler(async ({ data }) => {
    await requireUser()
    const [companyName, allRows] = await Promise.all([getCompanyName(), loadTrialBalance(data)])
    const rows = filterRows(allRows, data)
    const { debits, credits } = totalRows(rows)

    const { workbook, sheet } = startReportSheet({
      companyName,
      title: "Trial Balance",
      period: data,
      columns: [
        { key: "account", width: 40 },
        { key: "type", width: 14 },
        { key: "debit", width: 16 },
        { key: "credit", width: 16 },
      ],
    })
    const header = addHeaderRow(sheet, ["Account", "Type", "Debit", "Credit"], [3, 4])

    for (const row of rows) {
      sheet.addRow([
        row.isArchived ? `${row.fullName} (archived)` : row.fullName,
        row.accountType,
        row.balance > 0 ? row.balance : null,
        row.balance < 0 ? -row.balance : null,
      ])
    }

    const first = header.number + 1
    const last = header.number + rows.length
    const total = sheet.addRow([
      "Total",
      null,
      rows.length > 0 ? { formula: `SUM(C${first}:C${last})`, result: debits } : debits,
      rows.length > 0 ? { formula: `SUM(D${first}:D${last})`, result: credits } : credits,
    ])
    total.font = { bold: true }
    total.border = { top: { style: "thin" }, bottom: { style: "double" } }
    sheet.getColumn("debit").numFmt = MONEY_FORMAT
    sheet.getColumn("credit").numFmt = MONEY_FORMAT

    return await toExcelFile(workbook, "trial-balance", data)
  })
