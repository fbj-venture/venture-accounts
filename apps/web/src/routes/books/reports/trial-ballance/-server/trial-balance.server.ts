import { requireUser } from "#/lib/require-user.server.ts"
import { createServerFn } from "@tanstack/react-start"
import {
  loadTrialBalance,
  type TrialBalanceCriteria,
} from "./internal/trial-balance-data.server.ts"

export type { TrialBalanceCriteria }
export type TrialBalanceRow = Awaited<ReturnType<typeof getTrialBalance>>[number]

// The balance of every Account with posted Transactions in the period - see
// loadTrialBalance. Filtering by Account Type and archived Accounts is left to
// the page, so those filters don't need a round trip.
export const getTrialBalance = createServerFn({ method: "POST" })
  .validator((data: TrialBalanceCriteria) => data)
  .handler(async ({ data }) => {
    await requireUser()
    return await loadTrialBalance(data)
  })
