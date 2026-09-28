import { useEffect, useSyncExternalStore } from "react";

// Light/dark/system colour theme. "system" follows the OS setting and is the
// default - only an explicit Light or Dark choice is saved to localStorage,
// so choosing System again clears it. Backed by an external store (like
// useTablePageSize) so every consumer stays in sync.
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "system";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Runs inline in <head> before first paint (see __root.tsx), so a
// server-rendered page doesn't flash light before React hydrates. Must stay
// self-contained - keep in step with applyTheme below.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(value: Theme) {
  const isDark =
    value === "dark" || (value === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", isDark);
  // Native controls (scrollbars, date inputs) follow this, not the class.
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

let theme: Theme = DEFAULT_THEME;
let hydrated = false;
const listeners = new Set<() => void>();

function setTheme(value: Theme) {
  theme = value;
  try {
    if (value === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Ignore write failures (e.g. private browsing storage limits).
  }
  applyTheme(value);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  // Lazily read localStorage once per page load, on first subscriber.
  if (!hydrated) {
    hydrated = true;
    theme = readStoredTheme();
  }
  return theme;
}

function getServerSnapshot() {
  return DEFAULT_THEME;
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // While on System, follow the OS switching between light and dark.
  useEffect(() => {
    if (current !== "system") {
      return;
    }
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [current]);

  return [current, setTheme] as const;
}
