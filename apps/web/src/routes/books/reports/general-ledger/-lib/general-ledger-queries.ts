import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { getGeneralLedger, type GeneralLedgerCriteria } from "../-server/general-ledger.server.ts"

export const generalLedgerKeys = {
  all: ["general-ledger"] as const,
  range: (criteria: GeneralLedgerCriteria) => [...generalLedgerKeys.all, criteria] as const,
}

export const generalLedgerQuery = (criteria: GeneralLedgerCriteria) =>
  queryOptions({
    queryKey: generalLedgerKeys.range(criteria),
    queryFn: () => getGeneralLedger({ data: criteria }),
    // Keep showing the old figures while a new date range loads.
    placeholderData: keepPreviousData,
  })
