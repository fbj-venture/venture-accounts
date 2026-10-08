// Earliest year offered by any year drop-down.
export const FIRST_YEAR = 2020;

// FIRST_YEAR up to lastYear (default: this year), newest first.
export function yearsFromFirst(lastYear: number = currentYear()): number[] {
  const last = Math.max(lastYear, FIRST_YEAR);
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, index) => last - index);
}import { currentYear } from "./dates.ts";

