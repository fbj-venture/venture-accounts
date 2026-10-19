import { useCompanySettings } from "./company-settings.ts"

/** The first year every year drop-down and date picker offers (company_settings.starting_year). */
export const useStartingYear = () => useCompanySettings().startingYear
