import { navSectionsFromCookieHeader } from "#/hooks/use-nav-sections-open.ts"
import { sidebarOpenFromCookieHeader } from "#/hooks/use-sidebar-open.ts"
import { getOrCreateSettings } from "#/lib/app-settings.server.ts"
import { auth } from "#/lib/auth.ts"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

// The signed-in user and their app settings, in one round trip. The settings
// row is created with its default values the first time a user gets here
// after signing in (see getOrCreateSettings), then read like any other.
export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const authSession = await auth.api.getSession({ headers: getRequest().headers })
  if (!authSession) {
    return null
  }
  const { startingYear } = await getOrCreateSettings(authSession.user.id)
  // The sidebar's saved position comes with the cookie the browser sent, so
  // the page is drawn that way from the first paint (see use-sidebar-open.ts).
  const cookieHeader = getRequest().headers.get("cookie")
  const sidebarOpen = sidebarOpenFromCookieHeader(cookieHeader)
  // Likewise for which sections of the nav are open (use-nav-sections-open.ts).
  const navSections = navSectionsFromCookieHeader(cookieHeader)
  return { user: authSession.user, startingYear, sidebarOpen, navSections }
})
