import { createContext, useContext } from "react"

// What the year drop-downs fall back to when no settings have been loaded -
// only outside the signed-in area. It matches the app_settings default.
export const DEFAULT_STARTING_YEAR = 2024

// The signed-in user's app_settings.starting_year, provided by the /books
// layout (see routes/books/route.tsx). Kept in a module of its own so a hot
// reload of a component can't leave the provider and its consumers holding
// different context objects.
export const StartingYearContext = createContext<number>(DEFAULT_STARTING_YEAR)

/** The first year every year drop-down and date picker offers. */
export const useStartingYear = () => useContext(StartingYearContext)
