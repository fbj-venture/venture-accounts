import { queryOptions } from "@tanstack/react-query"
import { companyKeys } from "../books/admin/company/-lib/company-queries.ts"
import { getAppCompany } from "../-server/app-company.server.ts"

// The company name for the root route (page title, login page). Never stale:
// it is only re-read after saving the Company Settings invalidates
// companyKeys.all (the root route reads it with fetchQuery, which refetches an
// invalidated query).
export const appCompanyQuery = queryOptions({
  queryKey: [...companyKeys.all, "name"],
  queryFn: () => getAppCompany(),
  staleTime: Infinity,
})
