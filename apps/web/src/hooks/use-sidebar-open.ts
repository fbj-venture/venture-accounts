import { useSyncExternalStore } from "react"

// Whether the navigation sidebar is expanded (true) or collapsed to icons
// (false), remembered between pages, reloads, tabs and sign-ins. Backed by an
// external store (like useTheme) so every consumer stays in sync.
//
// It is saved in localStorage, and mirrored to a cookie. The cookie is what
// lets the *server* draw the sidebar in the saved position on the very first
// paint: the server can't see localStorage, and without it the page would
// arrive expanded and then pop to collapsed once the browser had loaded it.
// (The sidebar component writes this same cookie when it is toggled - see
// SIDEBAR_COOKIE_NAME in components/ui/sidebar.tsx.)
export const SIDEBAR_COOKIE_NAME = "sidebar_state"
const STORAGE_KEY = "sidebar_open"
const DEFAULT_OPEN = true
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Reads the saved state out of a Cookie header (server side). */
export function sidebarOpenFromCookieHeader(cookieHeader: string | null | undefined): boolean {
  const match = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
  return match === undefined ? DEFAULT_OPEN : match.slice(SIDEBAR_COOKIE_NAME.length + 1) === "true"
}

let open = DEFAULT_OPEN
let hydrated = false
const listeners = new Set<() => void>()

function writeCookie(value: boolean) {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function readStored(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      return stored === "true"
    }
  } catch {
    // Fall through to the cookie.
  }
  return sidebarOpenFromCookieHeader(document.cookie)
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function setOpen(value: boolean) {
  open = value
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Ignore write failures (e.g. private browsing storage limits): the
    // sidebar still works, it just isn't remembered by localStorage.
  }
  writeCookie(value)
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  // Another tab changed it: follow.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      open = readStored()
      listener()
    }
  }
  window.addEventListener("storage", onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot() {
  // Lazily read the saved state once per page load, on first use.
  if (!hydrated) {
    hydrated = true
    open = readStored()
    // Keep the cookie in step with localStorage (e.g. if the cookie expired),
    // so the next page load is drawn right by the server.
    writeCookie(open)
  }
  return open
}

/**
 * serverOpen: the state the server drew the page with, from the cookie it
 * received (sidebarOpenFromCookieHeader). It must be passed so the browser's
 * first render matches the server's HTML; the saved state then takes over.
 */
export function useSidebarOpen(serverOpen: boolean) {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => serverOpen)
  return [current, setOpen] as const
}
