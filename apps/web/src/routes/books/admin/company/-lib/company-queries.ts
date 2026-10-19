import { queryOptions } from "@tanstack/react-query"
import { getCompanySettings } from "../-server/company.server.ts"

// Query keys for the Company Settings page. Saving the settings invalidates
// companyKeys.all.
export const companyKeys = {
  all: ["company"] as const,
  settings: () => [...companyKeys.all, "settings"] as const,
}

export const companySettingsQuery = queryOptions({
  queryKey: companyKeys.settings(),
  queryFn: () => getCompanySettings(),
  // Never stale: it is only re-read when saving the settings invalidates it.
  staleTime: Infinity,
})
