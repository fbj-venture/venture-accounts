import { useEffect, useSyncExternalStore } from "react";

export type BreadcrumbItem = {
  title: string;
  url?: string;
};

let breadcrumbs: BreadcrumbItem[] = [];
const listeners = new Set<() => void>();

function setBreadcrumbs(items: BreadcrumbItem[]) {
  breadcrumbs = items;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return breadcrumbs;
}

/** Reads the breadcrumb trail set by the currently active page. */
export function useBreadcrumbs() {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}

/** Sets the breadcrumb trail for the page it's called from; cleared on unmount. */
export function useSetBreadcrumbs(items: BreadcrumbItem[]) {
  const key = JSON.stringify(items);
  useEffect(() => {
    setBreadcrumbs(items);
    return () => setBreadcrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
