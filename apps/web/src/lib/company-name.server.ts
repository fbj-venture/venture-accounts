import { DEFAULT_COMPANY_SETTINGS } from "#/lib/company-settings.ts"
import { company, db } from "@app/db/direct"
import { asc } from "drizzle-orm"

// Server-only: import it only inside server function handlers or other
// .server.ts modules, so the database driver stays out of the browser bundle.

// The company's name from company_settings (the default until an admin saves
// the Company Settings). Used wherever the app names the company: the page
// title, the login page and the emails it sends. Not secret - the login page
// shows it to everyone - so it needs no sign-in.
export async function getCompanyName(): Promise<string> {
  const [row] = await db
    .select({ name: company.name })
    .from(company)
    .orderBy(asc(company.id))
    .limit(1)
  return row?.name ?? DEFAULT_COMPANY_SETTINGS.name
}
