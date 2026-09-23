import { useSyncExternalStore } from "react";

// Shared by every paginated table in the app - one page-size preference
// re-used everywhere, per user request, rather than a per-table setting.
// Backed by an external store (not plain useState) so every table and the
// page-size dropdown - separate component instances - stay in sync the
// instant one of them changes it.
export const TABLE_PAGE_SIZE_OPTIONS = [15, 25, 50] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

const STORAGE_KEY = "table-page-size";
const DEFAULT_PAGE_SIZE: TablePageSize = 25;

function isTablePageSize(value: number): value is TablePageSize {
  return (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

function readStoredPageSize(): TablePageSize {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return isTablePageSize(stored) ? stored : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

let pageSize: TablePageSize = DEFAULT_PAGE_SIZE;
let hydrated = false;
const listeners = new Set<() => void>();

function setPageSize(size: TablePageSize) {
  pageSize = size;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // Ignore write failures (e.g. private browsing storage limits).
  }
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
    pageSize = readStoredPageSize();
  }
  return pageSize;
}

function getServerSnapshot() {
  return DEFAULT_PAGE_SIZE;
}

export function useTablePageSize() {
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [size, setPageSize] as const;
}
