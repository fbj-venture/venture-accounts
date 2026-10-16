import type { Transaction } from "@app/models"
import { buildLines, MONTH_NAMES, type TextContentItem } from "./extractor.js"
import { withHashes } from "./transaction.js"

// The "Transaction History Statement" a customer downloads from the bank's
// website at any time: everything since a chosen date, newest transactions
// included, before the official monthly statement is issued. Its rows carry a
// full date and one signed amount, e.g.
//   "14 Sep 2026   Gift - ib transfer   +150.00   409.27"
// (the older, official layout is read by extractor.ts).

const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3))

const TITLE_PATTERN = /Transaction History Statement/i

// e.g. "Account number:     22 103 917 1" - the digits are space-separated.
const ACCOUNT_NUMBER_PATTERN = /Account number:\s*([\d ]+\d)/i

// e.g. "Transaction date range:     13 Sep 2026 - 13 Oct 2026".
const DATE_RANGE_PATTERN =
  /Transaction date range:\s*(\d{1,2} [A-Za-z]{3} \d{4})\s*-\s*(\d{1,2} [A-Za-z]{3} \d{4})/i

// A transaction starts with its date, e.g. "14 Sep 2026".
const ROW_START_PATTERN = /^\d{1,2} [A-Z][a-z]{2} \d{4}\b/

// A whole transaction: date, description, signed amount, running balance. Its
// text can wrap over several lines, so this is matched against the lines of a
// transaction joined together.
const ROW_PATTERN =
  /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})\s+(.+?)\s+([+-]\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s*$/

// An item still waiting to be settled: it isn't on the official statement yet
// and has no stable amount or balance, so it isn't imported.
const PENDING_PATTERN = /outstanding card authori[sz]ation/i

export type HistoryStatement = {
  accountNumber: string
  /** First and last day of the range the bank printed, "yyyy-MM-dd". */
  rangeStart: string
  rangeEnd: string
  transactions: Transaction[]
  /** Items skipped because they are still pending (see PENDING_PATTERN). */
  pendingCount: number
}

function toCents(text: string): number {
  return Math.round(Number(text.replace(/,/g, "")) * 100)
}

// "13 Sep 2026" -> "2026-09-13".
function shortDateToIso(text: string): string {
  const [day, monthText, year] = text.trim().split(/\s+/)
  const month = SHORT_MONTHS.indexOf(monthText ?? "") + 1
  if (month === 0) {
    throw new Error(`Unrecognised month in "${text}".`)
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// "yyyy-MM-dd" -> "13 October 2026" (the statement-date text the importer
// reports, as for the official statements).
export function isoToStatementDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return `${day} ${MONTH_NAMES[(month ?? 1) - 1]} ${year}`
}

// Whether these first-page lines are a Transaction History Statement.
export function isHistoryStatement(firstPageItems: TextContentItem[]): boolean {
  return buildLines(firstPageItems).some((line) => TITLE_PATTERN.test(line))
}

// `pages` is the text content of every page, in order. Throws if the layout
// isn't recognised, a row can't be read, or the running balances don't add up
// - a misread row is far worse than a refused import.
export function extractHistory(pages: TextContentItem[][]): HistoryStatement {
  const pageLines = pages.map((items) => buildLines(items).map((line) => line.trim()))
  const firstPage = pageLines[0] ?? []

  if (!firstPage.some((line) => TITLE_PATTERN.test(line))) {
    throw new Error('This isn\'t a "Transaction History Statement" PDF.')
  }
  const header = firstPage.join("\n")
  const accountMatch = ACCOUNT_NUMBER_PATTERN.exec(header)
  if (!accountMatch) {
    throw new Error("Could not find the account number on the first page.")
  }
  const rangeMatch = DATE_RANGE_PATTERN.exec(header)
  if (!rangeMatch) {
    throw new Error("Could not find the transaction date range on the first page.")
  }
  const accountNumber = (accountMatch[1] ?? "").replace(/\s+/g, "")
  const rangeStart = shortDateToIso(rangeMatch[1] ?? "")
  const rangeEnd = shortDateToIso(rangeMatch[2] ?? "")

  const settled: Omit<Transaction, "hash">[] = []
  let pendingCount = 0

  for (const [pageIndex, lines] of pageLines.entries()) {
    // The lines of the transaction being read. A transaction that fits on one
    // line completes at once; a wrapped one (e.g. a pending card
    // authorisation) collects lines until it does. Lines that aren't part of
    // one (headers, footnotes) are ignored.
    let open: string[] = []

    for (const line of lines) {
      if (line.length === 0) {
        continue
      }
      if (ROW_START_PATTERN.test(line)) {
        if (open.length > 0) {
          throw new Error(
            `Could not read the transaction starting "${open[0]}" (page ${pageIndex + 1}).`,
          )
        }
        open = [line]
      } else if (open.length > 0) {
        open.push(line)
      } else {
        continue
      }

      const match = ROW_PATTERN.exec(open.join(" "))
      if (!match) {
        continue
      }
      open = []

      const [, day, monthText, year, description = "", amountText = "", balanceText = ""] = match
      if (PENDING_PATTERN.test(description)) {
        pendingCount += 1
        continue
      }
      const month = SHORT_MONTHS.indexOf(monthText ?? "") + 1
      if (month === 0) {
        throw new Error(`Unrecognised month in "${line}".`)
      }
      settled.push({
        details: description.trim(),
        serviceFee: 0,
        amount: toCents(amountText) / 100,
        // A calendar date, stored as UTC midnight (see toTransaction).
        date: new Date(Date.UTC(Number(year), month - 1, Number(day))),
        balance: toCents(balanceText) / 100,
      })
    }

    if (open.length > 0) {
      throw new Error(
        `Could not read the transaction starting "${open[0]}" (page ${pageIndex + 1}).`,
      )
    }
  }

  checkRunningBalances(settled)

  return {
    accountNumber,
    rangeStart,
    rangeEnd,
    transactions: withHashes(settled, accountNumber),
    pendingCount,
  }
}

// Every row's balance must be the previous one plus its amount, and rows must
// run oldest to newest. If not, something was misread (or the file isn't what
// it looks like) and nothing should be imported.
function checkRunningBalances(rows: Omit<Transaction, "hash">[]): void {
  for (let index = 1; index < rows.length; index++) {
    const previous = rows[index - 1]!
    const row = rows[index]!
    const expected = Math.round(previous.balance * 100) + Math.round(row.amount * 100)
    if (Math.round(row.balance * 100) !== expected) {
      throw new Error(
        `The running balance doesn't add up at "${row.details}" (row ${index + 1}): expected ${(expected / 100).toFixed(2)}, the statement says ${row.balance.toFixed(2)}.`,
      )
    }
    if (row.date < previous.date) {
      throw new Error(
        `The transactions aren't in date order at "${row.details}" (row ${index + 1}).`,
      )
    }
  }
}
