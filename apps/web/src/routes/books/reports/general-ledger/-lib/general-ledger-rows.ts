import { filterRows, type ReportFilters } from "../../-lib/report-rows.ts"

// How the General Ledger groups, runs and totals its lines, shared by the page
// and the Excel export so the two can't disagree. No server-only imports: the
// browser uses it too.

export type LedgerLine = {
  id: number
  accountId: number
  fullName: string
  accountTypeId: number
  accountType: string
  isArchived: boolean
  date: Date
  /** The Transaction's note. */
  note: string
  /** The line's own description (e.g. the bank statement's text), if any. */
  description: string | null
  /** Signed: positive is a debit, negative a credit. */
  amount: number
}

export type LedgerEntry = LedgerLine & {
  debit: number
  credit: number
  /** The Account's running balance after this line; positive is a debit balance. */
  balance: number
}

export type LedgerAccount = {
  accountId: number
  fullName: string
  accountType: string
  isArchived: boolean
  entries: LedgerEntry[]
  debits: number
  credits: number
  /** Debits less credits: positive is a debit balance, negative a credit balance. */
  balance: number
}

// One section per Account, in the order the lines arrive (Account Type, then
// name) with each Account's lines in date order. The running balance starts
// from nothing at the start of the period, as the Trial Balance's does. Summed
// in cents so the figures don't pick up floating point dust.
export function buildLedger(lines: LedgerLine[], filters: ReportFilters): LedgerAccount[] {
  const accounts = new Map<number, LedgerAccount>()
  for (const line of filterRows(lines, filters)) {
    let section = accounts.get(line.accountId)
    if (!section) {
      section = {
        accountId: line.accountId,
        fullName: line.fullName,
        accountType: line.accountType,
        isArchived: line.isArchived,
        entries: [],
        debits: 0,
        credits: 0,
        balance: 0,
      }
      accounts.set(line.accountId, section)
    }
    const cents = Math.round(line.amount * 100)
    section.debits = (Math.round(section.debits * 100) + Math.max(cents, 0)) / 100
    section.credits = (Math.round(section.credits * 100) + Math.max(-cents, 0)) / 100
    section.balance = (Math.round(section.balance * 100) + cents) / 100
    section.entries.push({
      ...line,
      debit: Math.max(cents, 0) / 100,
      credit: Math.max(-cents, 0) / 100,
      balance: section.balance,
    })
  }
  return [...accounts.values()]
}

/** What a line is for: the Transaction's note, then the line's own text if it adds anything. */
export function describeLine(line: Pick<LedgerLine, "note" | "description">) {
  const extra = line.description?.trim()
  return extra && extra !== line.note ? `${line.note} - ${extra}` : line.note
}
