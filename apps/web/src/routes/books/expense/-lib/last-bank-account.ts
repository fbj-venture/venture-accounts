// The bank account last chosen for adding an expense, kept in this browser so
// the dashboard card and the form open on it next time. Storage can be
// unavailable (private windows, blocked site data), so every access is guarded.
const STORAGE_KEY = "venture.expense.lastBankAccountId"

export function readLastBankAccountId(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

export function saveLastBankAccountId(id: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // Nothing to do: the choice just isn't remembered.
  }
}
