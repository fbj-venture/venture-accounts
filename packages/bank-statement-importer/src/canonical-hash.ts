import { createHash } from "node:crypto"

// The import hash identifies one bank transaction so importing the same one
// twice - from an overlapping statement, or from a different statement
// layout - is recognised and skipped. It is built only from facts every layout
// carries, each in one canonical form. Anything that varies by layout or can
// be edited later (the details text, the running balance, the row's position
// in the file, the service fee) is deliberately left out.
//
// Bump HASH_VERSION if the recipe ever changes, so old and new hashes can be
// told apart.
export const HASH_VERSION = "v2"

export type HashParts = {
  /** The bank account number; only its digits are used. */
  accountNumber: string
  /** The transaction's calendar date, "yyyy-MM-dd". */
  isoDate: string
  /** The signed amount in cents: money in is positive, money out negative. */
  cents: number
  /**
   * 1 for the first transaction in the file with this account, date and
   * amount, 2 for the second, and so on. It tells apart genuinely identical
   * transactions (two R50 payments on one day) without depending on where in
   * the file they sit. See occurrenceNumbers.
   */
  occurrence: number
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function canonicalHash(parts: HashParts): string {
  const accountDigits = parts.accountNumber.replace(/\D/g, "")
  if (accountDigits === "") {
    throw new Error(
      `Can't hash a transaction without an account number ("${parts.accountNumber}").`,
    )
  }
  if (!ISO_DATE_PATTERN.test(parts.isoDate)) {
    throw new Error(`Can't hash a transaction with the date "${parts.isoDate}" (want yyyy-MM-dd).`)
  }
  if (!Number.isSafeInteger(parts.cents)) {
    throw new Error(`Can't hash a transaction with ${parts.cents} cents (want a whole number).`)
  }
  if (!Number.isInteger(parts.occurrence) || parts.occurrence < 1) {
    throw new Error(
      `Can't hash a transaction with occurrence ${parts.occurrence} (want 1 or more).`,
    )
  }

  const canonical = [HASH_VERSION, accountDigits, parts.isoDate, parts.cents, parts.occurrence]
  return createHash("sha256").update(canonical.join("|")).digest("hex")
}

// ZAR amount (as a JS number, two decimals) to whole cents.
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

// A date held as UTC midnight (how the database stores calendar dates) to
// "yyyy-MM-dd".
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// For items in file order, the occurrence number of each: how many items so
// far (itself included) share its date and amount. `key` returns the part of
// an item that must match, e.g. `${isoDate}|${cents}`.
export function occurrenceNumbers<T>(items: T[], key: (item: T) => string): number[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const k = key(item)
    const occurrence = (seen.get(k) ?? 0) + 1
    seen.set(k, occurrence)
    return occurrence
  })
}
