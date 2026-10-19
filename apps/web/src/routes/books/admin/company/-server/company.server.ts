import {
  DEFAULT_COMPANY_SETTINGS,
  companyProblem,
  type CompanySettings,
} from "#/lib/company-settings.ts"
import { requireAdmin } from "#/lib/require-admin.server.ts"
import { requireUser } from "#/lib/require-user.server.ts"
import { company, db, withCreate, withUpdate } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { asc, eq } from "drizzle-orm"

// Keep ALL database code inside handlers - see transactions-fn.ts for why.

// The company_settings row, or the defaults when nothing has been saved yet.
// Any signed-in user may read it (the name is in every page's sidebar and the
// starting year feeds every year list); only admins can save it.
export const getCompanySettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompanySettings> => {
    await requireUser()
    const [row] = await db
      .select({
        name: company.name,
        financialYearEndMonth: company.financialYearEndMonth,
        startingYear: company.startingYear,
      })
      .from(company)
      .orderBy(asc(company.id))
      .limit(1)
    return row ?? DEFAULT_COMPANY_SETTINGS
  },
)

// There is only ever one row: the first save inserts it, later ones update it.
export const saveCompanySettings = createServerFn({ method: "POST" })
  .validator((data: CompanySettings) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireAdmin()
    const values: CompanySettings = {
      name: data.name.trim(),
      financialYearEndMonth: data.financialYearEndMonth,
      startingYear: data.startingYear,
    }
    const problem = companyProblem(values)
    if (problem) {
      throw new Error(problem)
    }

    const [existing] = await db
      .select({ id: company.id })
      .from(company)
      .orderBy(asc(company.id))
      .limit(1)
    if (existing) {
      await db.update(company).set(withUpdate(userId, values)).where(eq(company.id, existing.id))
    } else {
      await db.insert(company).values(withCreate(userId, values))
    }
  })
