// Server-only: import it only inside server function handlers.
import { getOrCreateSettings } from "./app-settings.server.ts"

// Sorts bank accounts into the signed-in user's own order (the one they set by
// dragging the cards on the dashboard - settings.bankAccountOrder). Accounts
// they haven't placed yet go after the placed ones, in the order they came in
// (callers pass them already sorted by name). Use it for every list or
// drop-down of bank accounts, so they all agree.
export async function sortByBankAccountOrder<T>(
  userId: string,
  rows: T[],
  getId: (row: T) => number,
): Promise<T[]> {
  const { bankAccountOrder } = await getOrCreateSettings(userId)
  const rank = (row: T) => {
    const index = bankAccountOrder.indexOf(getId(row))
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }
  // Array.sort is stable, so unplaced accounts keep their incoming order.
  return [...rows].sort((a, b) => rank(a) - rank(b))
}
