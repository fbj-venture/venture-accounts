import { createContext, useContext } from "react"
import { currentYear } from "./dates.ts"

// The company-wide settings (company_settings): shared by the Company Settings
// form, the server functions and the /books layout's provider. No server-only
// imports here, so the browser can use it.
export type CompanySettings = {
  name: string
  financialYearEndMonth: number
  /** The first year offered by every year drop-down and date picker. */
  startingYear: number
  /** Keys of the importers whose cards are hidden on the Kind of Import page. */
  hiddenImporters: string[]
}

// What the Company form edits; hiddenImporters has a card and save of its own.
export type CompanyDetails = Omit<CompanySettings, "hiddenImporters">

// What the settings are until an admin saves them. Also what the app falls
// back to outside the signed-in area, where none have been loaded.
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: "Venture",
  financialYearEndMonth: 2,
  startingYear: 2024,
  hiddenImporters: [],
}

// The earliest year the year lists can start at.
export const MIN_STARTING_YEAR = 2000

/** Why the settings aren't acceptable, or null if they are. Shared by the form and the server. */
export function companyProblem(values: CompanyDetails): string | null {
  if (!values.name.trim()) {
    return "The company name is required."
  }
  if (
    !Number.isInteger(values.financialYearEndMonth) ||
    values.financialYearEndMonth < 1 ||
    values.financialYearEndMonth > 12
  ) {
    return "The financial year end month must be between 1 and 12."
  }
  if (!Number.isInteger(values.startingYear)) {
    return "The starting year must be a whole number."
  }
  if (values.startingYear < MIN_STARTING_YEAR || values.startingYear > currentYear()) {
    return `The starting year must be between ${MIN_STARTING_YEAR} and ${currentYear()}.`
  }
  return null
}

// Provided by the /books layout (see routes/books/route.tsx). Kept in a module
// of its own so a hot reload of a component can't leave the provider and its
// consumers holding different context objects.
export const CompanySettingsContext = createContext<CompanySettings>(DEFAULT_COMPANY_SETTINGS)

/** The company settings, as loaded by the /books layout. */
export const useCompanySettings = () => useContext(CompanySettingsContext)
