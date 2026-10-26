import { navSectionsFromCookieHeader } from "#/hooks/use-nav-sections-open.ts"
import { sidebarOpenFromCookieHeader } from "#/hooks/use-sidebar-open.ts"
import { getSessionState } from "#/lib/auth-session.server.ts"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

// The signed-in user and the browser's saved layout state, in one round trip.
export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const authSession = await getSessionState(getRequest().headers)
  if (authSession.state === "none") {
    return null
  }
  // Signed in with a password but the passkey is still owed.
  if (authSession.state === "pending") {
    return { pending: true as const }
  }
  // The sidebar's saved position comes with the cookie the browser sent, so
  // the page is drawn that way from the first paint (see use-sidebar-open.ts).
  const cookieHeader = getRequest().headers.get("cookie")
  const sidebarOpen = sidebarOpenFromCookieHeader(cookieHeader)
  // Likewise for which sections of the nav are open (use-nav-sections-open.ts).
  const navSections = navSectionsFromCookieHeader(cookieHeader)
  return { user: authSession.user, sidebarOpen, navSections }
})
