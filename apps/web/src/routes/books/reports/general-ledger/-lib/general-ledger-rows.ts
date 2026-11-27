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

/** What an Account stood at just before the period started. */
export type LedgerOpening = Pick<
  LedgerLine,
  "accountId" | "fullName" | "accountTypeId" | "accountType" | "isArchived"
> & {
  /** Signed: positive is a debit balance. */
  opening: number
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
  /** The balance brought forward into the period (zero when none). */
  opening: number
  entries: LedgerEntry[]
  /** Totals of the period's own lines, not including the opening balance. */
  debits: number
  credits: number
  /** The closing balance: opening plus debits less credits. Positive is a debit balance, negative a credit balance. */
  balance: number
}

// One section per Account, in Account Type order then by name, with each
// Account's lines in date order. The running balance starts from the Account's
// opening balance (what it stood at before the period), and an Account with a
// balance brought forward is shown even if it has no lines in the period.
// Summed in cents so the figures don't pick up floating point dust.
export function buildLedger(
  lines: LedgerLine[],
  openings: LedgerOpening[],
  filters: ReportFilters,
): LedgerAccount[] {
  const accounts = new Map<number, LedgerAccount>()
  const order = new Map<number, { typeId: number; name: string }>()
  const sectionFor = (
    line: Pick<LedgerOpening, "accountId" | "fullName" | "accountType" | "isArchived">,
  ) => {
    let section = accounts.get(line.accountId)
    if (!section) {
      section = {
        accountId: line.accountId,
        fullName: line.fullName,
        accountType: line.accountType,
        isArchived: line.isArchived,
        opening: 0,
        entries: [],
        debits: 0,
        credits: 0,
        balance: 0,
      }
      accounts.set(line.accountId, section)
    }
    return section
  }
  for (const opening of filterRows(openings, filters)) {
    if (Math.round(opening.opening * 100) === 0) continue
    const section = sectionFor(opening)
    section.opening = opening.opening
    section.balance = opening.opening
    order.set(opening.accountId, { typeId: opening.accountTypeId, name: opening.fullName })
  }
  for (const line of filterRows(lines, filters)) {
    const section = sectionFor(line)
    order.set(line.accountId, { typeId: line.accountTypeId, name: line.fullName })
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
  // Account Type order (the canonical one the loaders use), then by name.
  return [...accounts.values()].sort((a, b) => {
    const left = order.get(a.accountId)!
    const right = order.get(b.accountId)!
    return (
      left.typeId - right.typeId ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    )
  })
}

/** What a line is for: the Transaction's note, then the line's own text if it adds anything. */
export function describeLine(line: Pick<LedgerLine, "note" | "description">) {
  const extra = line.description?.trim()
  return extra && extra !== line.note ? `${line.note} - ${extra}` : line.note
}
