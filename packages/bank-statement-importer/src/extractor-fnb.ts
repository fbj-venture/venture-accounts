import type { Transaction } from "@app/models"
import { buildLines, MONTH_NAMES, type TextContentItem } from "./extractor.js"
import { withHashes } from "./transaction.js"

// An FNB statement (e.g. "FNB Aspire Current Account"). Its rows carry a day
// and short month but no year, a description, one amount (a credit has "Cr"
// after it, a debit has nothing) and the running balance, e.g.
//   "03 Jan   POS Purchase Liquorshop Ferndale  457896*9459 01 Jan   254.98   5,564.27Cr"
// The Standard Bank layouts are read by extractor.ts and extractor-history.ts.

const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3))

const DATE = String.raw`(\d{1,2} [A-Za-z]+ \d{4})`

// e.g. "FNB Aspire Current Account : 62064747606"
const ACCOUNT_NUMBER_PATTERN = /^FNB .+?\s*:\s*(\d{6,})\s*$/m

// e.g. "Statement Period : 2 January 2026 to 2 February 2026"
const PERIOD_PATTERN = new RegExp(String.raw`Statement Period\s*:\s*${DATE}\s+to\s+${DATE}`)

// e.g. "Statement Date : 2 February 2026"
const STATEMENT_DATE_PATTERN = new RegExp(String.raw`Statement Date\s*:\s*${DATE}`)

// e.g. "Tax Invoice/Statement Number : 267"
const STATEMENT_NUMBER_PATTERN = /Statement Number\s*:\s*(\d+)/

// e.g. "Opening Balance   5,819.25 Cr" (the summary at the top of page 1).
const OPENING_BALANCE_PATTERN = /^Opening Balance\s+([\d,]+\.\d{2})\s*(Cr|Dr)\s*$/m

// e.g. "No. Credit Transactions 3   3,580.00 Cr" and "No. Debit Transactions
// 18   7,017.94 Dr" (the turnover on the last page).
const CREDIT_TURNOVER_PATTERN = /No\. Credit Transactions\s+(\d+)\s+([\d,]+\.\d{2})\s*Cr/
const DEBIT_TURNOVER_PATTERN = /No\. Debit Transactions\s+(\d+)\s+([\d,]+\.\d{2})\s*Dr/

// A transaction is one line: day and month, description (which can be empty
// for a bank charge and can hold a reference), the amount ("Cr" marks a
// credit) and the running balance ("Cr" credit, "Dr" or nothing overdrawn).
const ROW_PATTERN =
  /^(\d{2}) ([A-Z][a-z]{2})\s+(.*?)\s*([\d,]+\.\d{2})(Cr)?\s+([\d,]+\.\d{2})(Cr|Dr)?\s*$/

// What a bank charge shows as when the statement gives it no description.
const UNDESCRIBED_ROW = "Bank charge"

export type FnbStatement = {
  accountNumber: string
  statementNumber: string
  /** The statement's own date and the first and last day it covers, "yyyy-MM-dd". */
  statementDate: string
  periodStart: string
  periodEnd: string
  transactions: Transaction[]
}

const toCents = (text: string): number => Math.round(Number(text.replace(/,/g, "")) * 100)

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0")
}

// "2 February 2026" -> "2026-02-02".
function longDateToIso(text: string): string {
  const [day, monthName, year] = text.trim().split(/\s+/)
  const month = MONTH_NAMES.indexOf(monthName ?? "") + 1
  if (month === 0) {
    throw new Error(`Unrecognised month in "${text}".`)
  }
  return `${year}-${pad(month, 2)}-${pad(Number(day), 2)}`
}

// Whether these first-page items are an FNB statement.
export function isFnbStatement(firstPageItems: TextContentItem[]): boolean {
  const text = buildLines(firstPageItems).join("\n")
  return ACCOUNT_NUMBER_PATTERN.test(text) && PERIOD_PATTERN.test(text)
}

// `pages` is the text content of every page, in order. Throws if the layout
// isn't recognised, or if the rows don't agree with the statement's own
// figures (opening and closing balance, running balances, turnover) - a
// misread row is far worse than a refused import.
export function extractFnb(pages: TextContentItem[][]): FnbStatement {
  const pageLines = pages.map((items) => buildLines(items).map((line) => line.trim()))
  const header = (pageLines[0] ?? []).join("\n")
  const allText = pageLines.flat().join("\n")

  const accountMatch = ACCOUNT_NUMBER_PATTERN.exec(header)
  const periodMatch = PERIOD_PATTERN.exec(header)
  if (!accountMatch || !periodMatch) {
    throw new Error("This isn't an FNB statement PDF.")
  }
  const dateMatch = STATEMENT_DATE_PATTERN.exec(header)
  if (!dateMatch) {
    throw new Error("Could not find the statement date on the first page.")
  }
  const openingMatch = OPENING_BALANCE_PATTERN.exec(header)
  if (!openingMatch) {
    throw new Error("Could not find the opening balance on the first page.")
  }
  const accountNumber = accountMatch[1] ?? ""
  const statementNumber = STATEMENT_NUMBER_PATTERN.exec(header)?.[1] ?? ""
  const periodStart = longDateToIso(periodMatch[1] ?? "")
  const periodEnd = longDateToIso(periodMatch[2] ?? "")
  const openingCents = (openingMatch[2] === "Dr" ? -1 : 1) * toCents(openingMatch[1] ?? "")

  const rows: (Omit<Transaction, "hash"> & { credit: boolean })[] = []
  for (const line of pageLines.flat()) {
    const match = ROW_PATTERN.exec(line)
    if (!match) {
      continue
    }
    const [, day, monthText, description = "", amountText = "", credit, balanceText = "", sign] =
      match
    const month = SHORT_MONTHS.indexOf(monthText ?? "") + 1
    if (month === 0) {
      continue
    }
    const isoDate = dateInPeriod(Number(day), month, periodStart, periodEnd, line)
    const amountCents = toCents(amountText)
    rows.push({
      details: description.replace(/\s+/g, " ").trim() || UNDESCRIBED_ROW,
      serviceFee: 0,
      amount: (credit ? amountCents : -amountCents) / 100,
      // A calendar date, stored as UTC midnight (see toTransaction).
      date: new Date(`${isoDate}T00:00:00Z`),
      balance: (sign === "Cr" ? toCents(balanceText) : -toCents(balanceText)) / 100,
      credit: credit === "Cr",
    })
  }

  checkRows(rows, openingCents, allText)

  return {
    accountNumber,
    statementNumber,
    statementDate: longDateToIso(dateMatch[1] ?? ""),
    periodStart,
    periodEnd,
    transactions: withHashes(
      rows.map(({ credit: _credit, ...transaction }) => transaction),
      accountNumber,
    ),
  }
}

// Rows have no year: it is whichever of the period's years puts the date
// inside the period.
function dateInPeriod(
  day: number,
  month: number,
  periodStart: string,
  periodEnd: string,
  line: string,
): string {
  const startYear = Number(periodStart.slice(0, 4))
  const endYear = Number(periodEnd.slice(0, 4))
  for (const year of new Set([endYear, startYear])) {
    const iso = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
    if (iso >= periodStart && iso <= periodEnd) {
      return iso
    }
  }
  throw new Error(`The date of "${line}" is outside the statement period.`)
}

// Everything the statement says about itself must agree with the rows read.
function checkRows(
  rows: { details: string; amount: number; balance: number; credit: boolean }[],
  openingCents: number,
  allText: string,
): void {
  if (rows.length === 0) {
    throw new Error("No transactions were found on the statement.")
  }

  let previousCents = openingCents
  for (const [index, row] of rows.entries()) {
    const expected = previousCents + Math.round(row.amount * 100)
    if (Math.round(row.balance * 100) !== expected) {
      throw new Error(
        `The running balance doesn't add up at "${row.details}" (row ${index + 1}): expected ${(expected / 100).toFixed(2)}, the statement says ${row.balance.toFixed(2)}.`,
      )
    }
    previousCents = expected
  }

  const credits = rows.filter((row) => row.credit)
  const debits = rows.filter((row) => !row.credit)
  const sumCents = (list: typeof rows) =>
    list.reduce((total, row) => total + Math.abs(Math.round(row.amount * 100)), 0)
  for (const [label, pattern, list] of [
    ["credit", CREDIT_TURNOVER_PATTERN, credits],
    ["debit", DEBIT_TURNOVER_PATTERN, debits],
  ] as const) {
    const match = pattern.exec(allText)
    if (!match) {
      throw new Error(`Could not find the number of ${label} transactions on the statement.`)
    }
    if (Number(match[1]) !== list.length || toCents(match[2] ?? "") !== sumCents(list)) {
      throw new Error(
        `The ${label} transactions read (${list.length}, ${(sumCents(list) / 100).toFixed(2)}) don't match the statement's turnover (${match[1]}, ${match[2]}).`,
      )
    }
  }
}
