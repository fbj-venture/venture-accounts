import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { getTrialBalance, type TrialBalanceCriteria } from "../-server/trial-balance.server.ts"

export const trialBalanceKeys = {
  all: ["trial-balance"] as const,
  range: (criteria: TrialBalanceCriteria) => [...trialBalanceKeys.all, criteria] as const,
}

export const trialBalanceQuery = (criteria: TrialBalanceCriteria) =>
  queryOptions({
    queryKey: trialBalanceKeys.range(criteria),
    queryFn: () => getTrialBalance({ data: criteria }),
    // Keep showing the old figures while a new date range loads.
    placeholderData: keepPreviousData,
  })
