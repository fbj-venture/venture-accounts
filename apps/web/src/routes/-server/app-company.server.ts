import { getCompanyName } from "#/lib/company-name.server.ts"
import { createServerFn } from "@tanstack/react-start"

// The company name from company_settings. Public (no sign-in needed): the
// login page and the page title show it to everyone.
export const getAppCompany = createServerFn({ method: "GET" }).handler(() => getCompanyName())
