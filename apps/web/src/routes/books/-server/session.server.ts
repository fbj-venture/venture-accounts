import { navSectionsFromCookieHeader } from "#/hooks/use-nav-sections-open.ts"
import { sidebarOpenFromCookieHeader } from "#/hooks/use-sidebar-open.ts"
import { auth } from "#/lib/auth.ts"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

// The signed-in user and the browser's saved layout state, in one round trip.
export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const authSession = await auth.api.getSession({ headers: getRequest().headers })
  if (!authSession) {
    return null
  }
  // The sidebar's saved position comes with the cookie the browser sent, so
  // the page is drawn that way from the first paint (see use-sidebar-open.ts).
  const cookieHeader = getRequest().headers.get("cookie")
  const sidebarOpen = sidebarOpenFromCookieHeader(cookieHeader)
  // Likewise for which sections of the nav are open (use-nav-sections-open.ts).
  const navSections = navSectionsFromCookieHeader(cookieHeader)
  return { user: authSession.user, sidebarOpen, navSections }
})
