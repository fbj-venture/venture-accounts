import { currentYear } from "./dates.ts";

// startingYear (the user's app_settings.starting_year, see useStartingYear)
// up to lastYear (default: this year), newest first. Never empty: a
// lastYear before the starting year still yields the starting year.
export function yearsFromStart(startingYear: number, lastYear: number = currentYear()): number[] {
  const last = Math.max(lastYear, startingYear);
  return Array.from({ length: last - startingYear + 1 }, (_, index) => last - index);
}
