import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { getAuthSession } from "../-server/session.server.ts"

// The signed-in user and settings are looked up once and reused by every
// navigation under /books, not re-fetched on each click. The lifetime matches
// better-auth's session cookieCache (see lib/auth.ts), so a ban or role
// change takes effect within the same window. Server functions still check
// the session themselves (requireUser / requireAdmin), so this only affects
// what the layout shows.
export const SESSION_STALE_TIME = 5 * 60 * 1000

export const sessionQuery = queryOptions({
  queryKey: ["auth-session"],
  queryFn: () => getAuthSession(),
  staleTime: SESSION_STALE_TIME,
})

// Forget everything held for the previous user. Call on sign-in and sign-out.
export function clearSessionCache(queryClient: QueryClient) {
  queryClient.clear()
}

// Call after changing something the layout shows (e.g. the starting year).
export function refreshSession(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey })
}
