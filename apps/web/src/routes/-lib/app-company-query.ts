import { queryOptions } from "@tanstack/react-query"
import { getAppCompany } from "../-server/app-company.server.ts"

// The value can only change when the server restarts, so fetch it once per
// page load (the server render hands it to the browser through the SSR query
// integration).
export const appCompanyQuery = queryOptions({
  queryKey: ["app-company"],
  queryFn: () => getAppCompany(),
  staleTime: Infinity,
})
