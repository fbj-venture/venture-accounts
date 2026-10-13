import { useSyncExternalStore } from "react";

// Which sections of the main navigation (Home, Banking, ...) are open, by
// title, remembered between pages, reloads, tabs and sign-ins. A section that
// has never been toggled isn't in the map and falls back to its default.
// Same design as useSidebarOpen: an external store, saved in localStorage and
// mirrored to a cookie so the *server* can draw the sections in their saved
// state on the very first paint (it can't see localStorage), instead of the
// page arriving with the defaults and then popping to the saved state.
export type NavSectionsOpen = Record<string, boolean>;

export const NAV_SECTIONS_COOKIE_NAME = "nav_sections";
const STORAGE_KEY = "nav_sections_open";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Keeps only the title -> boolean entries of whatever was stored. */
function parseSections(json: string | null | undefined): NavSectionsOpen {
  if (!json) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

/** Reads the saved sections out of a Cookie header (server side). */
export function navSectionsFromCookieHeader(cookieHeader: string | null | undefined): NavSectionsOpen {
  const match = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${NAV_SECTIONS_COOKIE_NAME}=`));
  if (match === undefined) {
    return {};
  }
  try {
    return parseSections(decodeURIComponent(match.slice(NAV_SECTIONS_COOKIE_NAME.length + 1)));
  } catch {
    return {};
  }
}

let sections: NavSectionsOpen = {};
let hydrated = false;
const listeners = new Set<() => void>();

function writeCookie(value: NavSectionsOpen) {
  document.cookie = `${NAV_SECTIONS_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readStored(): NavSectionsOpen {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return parseSections(stored);
    }
  } catch {
    // Fall through to the cookie.
  }
  return navSectionsFromCookieHeader(document.cookie);
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Opens or closes one section. */
export function setNavSectionOpen(title: string, open: boolean) {
  // A new object each time, so useSyncExternalStore sees the change.
  sections = { ...sections, [title]: open };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // Ignore write failures (e.g. private browsing storage limits): the
    // sections still work, they just aren't remembered by localStorage.
  }
  writeCookie(sections);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab changed it: follow.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      sections = readStored();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  // Lazily read the saved state once per page load, on first use.
  if (!hydrated) {
    hydrated = true;
    sections = readStored();
    // Keep the cookie in step with localStorage (e.g. if the cookie expired),
    // so the next page load is drawn right by the server.
    writeCookie(sections);
  }
  return sections;
}

/**
 * serverSections: the state the server drew the page with, from the cookie it
 * received (navSectionsFromCookieHeader). It must be passed so the browser's
 * first render matches the server's HTML; the saved state then takes over.
 */
export function useNavSectionsOpen(serverSections: NavSectionsOpen) {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSections);
}
