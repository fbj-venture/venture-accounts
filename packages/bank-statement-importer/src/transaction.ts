import type { Transaction } from "@app/models"
import { canonicalHash, occurrenceNumbers, toCents, toIsoDate } from "./canonical-hash.js"
import { MONTH_NAMES } from "./extractor.js"
import type { ImportRow } from "./import-row.js"

const STATEMENT_DATE_TEXT_PATTERN = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/

// Amounts are decimal strings like "12,662.23" or "1,132.83-" (a trailing
// "-" marks a negative value). Debits/credits are kept as non-negative
// magnitudes - the debit/credit column already conveys direction, and
// there's no such thing as a negative debit - but a negative balance is a
// genuinely overdrawn balance, so it keeps its sign via `signed`.
function parseAmount(value: string, options?: { signed?: boolean }): number {
  if (value.length === 0) {
    return 0
  }

  const isNegative = (options?.signed ?? false) && value.endsWith("-")
  const cleaned = value.replace(/,/g, "").replace(/-$/, "")
  const amount = Number(cleaned)

  return isNegative ? -amount : amount
}

function parseStatementDate(statementDate: string): {
  year: number
  month: number
  day: number
} {
  const match = STATEMENT_DATE_TEXT_PATTERN.exec(statementDate.trim())
  if (!match) {
    throw new Error(`Unrecognised statement date: "${statementDate}"`)
  }

  const [, dayText, monthName, yearText] = match
  const month = MONTH_NAMES.indexOf(monthName ?? "") + 1
  if (month === 0) {
    throw new Error(`Unrecognised month in statement date: "${statementDate}"`)
  }

  return {
    year: Number.parseInt(yearText ?? "", 10),
    month,
    day: Number.parseInt(dayText ?? "", 10),
  }
}

// "12 March 2024" -> "2024-03-12" (yyyy-MM-dd).
export function statementDateToIso(statementDate: string): string {
  const { year, month, day } = parseStatementDate(statementDate)
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-")
}

// Transaction rows only carry "MM DD" - no year - so the year is taken from
// the statement date. A transaction month that comes after the statement's
// own month must belong to the previous year (e.g. a December transaction
// on a statement dated in January).
function resolveTransactionYear(
  transactionMonth: number,
  statement: { year: number; month: number },
): number {
  return transactionMonth > statement.month ? statement.year - 1 : statement.year
}

// Without its hash: that needs the other rows too (see toTransactions).
function toTransaction(row: ImportRow, statementDate: string): Omit<Transaction, "hash"> {
  const statement = parseStatementDate(statementDate)

  const [monthText, dayText] = row.date.trim().split(/\s+/)
  const month = Number.parseInt(monthText ?? "", 10)
  const day = Number.parseInt(dayText ?? "", 10)
  const year = resolveTransactionYear(month, statement)

  // The statement's day is a calendar date (Africa/Johannesburg), and the
  // database stores such dates as UTC midnight of that same day - they are
  // shown in Africa/Johannesburg, where that is 02:00 on the same day. (Not
  // midnight in Johannesburg: that is 22:00 UTC the day before, and a date
  // column keeps the UTC day, so every transaction would land a day early.)
  const date = new Date(Date.UTC(year, month - 1, day))

  // Debits/credits are already mutually exclusive non-negative magnitudes
  // (see parseAmount above), so subtracting gives a single signed amount:
  // positive for a credit, negative for a debit.
  const amount = parseAmount(row.credits) - parseAmount(row.debits)

  return {
    details: row.details,
    serviceFee: parseAmount(row.serviceFee),
    amount,
    date,
    balance: parseAmount(row.balance, { signed: true }),
  }
}

// Each transaction also gets its import hash (see canonical-hash.ts): from the
// account, date and amount, plus how many rows before it in this file share
// the same date and amount. `rows` must be in file order and hold every row of
// each day they cover.
export function toTransactions(
  rows: ImportRow[],
  statementDate: string,
  accountNumber: string,
): Transaction[] {
  return withHashes(
    rows.map((row) => toTransaction(row, statementDate)),
    accountNumber,
  )
}

// Adds the import hash to transactions read from any statement layout, given
// in file order.
export function withHashes(
  transactions: Omit<Transaction, "hash">[],
  accountNumber: string,
): Transaction[] {
  const key = (transaction: Omit<Transaction, "hash">) =>
    `${toIsoDate(transaction.date)}|${toCents(transaction.amount)}`
  const occurrences = occurrenceNumbers(transactions, key)

  return transactions.map((transaction, index) => ({
    ...transaction,
    hash: canonicalHash({
      accountNumber,
      isoDate: toIsoDate(transaction.date),
      cents: toCents(transaction.amount),
      occurrence: occurrences[index]!,
    }),
  }))
}
