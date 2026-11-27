import { requireUser } from "#/lib/require-user.server.ts"
import { createServerFn } from "@tanstack/react-start"
import {
  loadGeneralLedger,
  loadOpeningBalances,
  type GeneralLedgerCriteria,
} from "./internal/general-ledger-data.server.ts"

export type { GeneralLedgerCriteria }

// Every posted line in the period, and what each Account stood at before it
// started - see loadGeneralLedger and loadOpeningBalances. Filtering by
// Account Type and archived Accounts is left to the page, so those filters
// don't need a round trip.
export const getGeneralLedger = createServerFn({ method: "POST" })
  .validator((data: GeneralLedgerCriteria) => data)
  .handler(async ({ data }) => {
    await requireUser()
    const [lines, openings] = await Promise.all([
      loadGeneralLedger(data),
      loadOpeningBalances(data),
    ])
    return { lines, openings }
  })
