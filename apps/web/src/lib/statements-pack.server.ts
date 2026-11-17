import { DEFAULT_COMPANY_SETTINGS } from "#/lib/company-settings.ts"
import { createZip } from "#/lib/zip.ts"
import { account, bankAccount, bankUpload, company, db, recon } from "@app/db/direct"
import { getFileBytes, isStorageConfigured } from "@app/storage"
import { and, asc, eq, isNotNull } from "drizzle-orm"
import { extname } from "node:path"

// Server-only: import it from handlers / API routes, never browser-reachable code.

type Month = { year: number; month: number }

// Characters that can't go in a file name on Windows (or are control characters).
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g

const monthLabel = new Intl.DateTimeFormat("en-ZA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const label = ({ year, month }: Month) => monthLabel.format(new Date(Date.UTC(year, month - 1, 1)))
const monthOf = (statementDate: string): Month => ({
  year: Number(statementDate.slice(0, 4)),
  month: Number(statementDate.slice(5, 7)),
})
const index = ({ year, month }: Month) => year * 12 + month - 1

// The 12 months of the financial year named for endYear (see financial-year.ts).
function monthsOfFinancialYear(endYear: number, endMonth: number): Month[] {
  const first = endYear * 12 + endMonth - 12
  return Array.from({ length: 12 }, (_, i) => ({
    year: Math.floor((first + i) / 12),
    month: ((first + i) % 12) + 1,
  }))
}

export type StatementsPackResult =
  | { ok: false; status: 400 | 404 | 409 | 500; problem: string; missing?: string[] }
  | { ok: true; fileName: string; zip: Uint8Array }

// Builds the zip of every bank statement uploaded for one bank account in one
// financial year.
//
// A statement belongs to the calendar month its reconciliation's statement
// date falls in, and counts only once that reconciliation is linked to an
// upload. Every month of the year needs one - except before the account's
// first statement (it may have been opened part way through the year) and,
// for an archived account, after its last. Months without one are returned in
// `missing` and nothing is zipped.
export async function buildStatementsPack(
  bankAccountId: number,
  endYear: number,
): Promise<StatementsPackResult> {
  if (!Number.isInteger(bankAccountId) || !Number.isInteger(endYear)) {
    return { ok: false, status: 400, problem: "Choose a bank account and a financial year." }
  }
  if (!isStorageConfigured()) {
    return { ok: false, status: 500, problem: "File storage isn't set up on this server." }
  }

  const [account_] = await db
    .select({ name: account.name, isArchived: bankAccount.isArchived })
    .from(bankAccount)
    .innerJoin(account, eq(account.id, bankAccount.id))
    .where(eq(bankAccount.id, bankAccountId))
  if (!account_) {
    return { ok: false, status: 404, problem: "Bank account not found." }
  }

  const [settings] = await db
    .select({ endMonth: company.financialYearEndMonth })
    .from(company)
    .orderBy(asc(company.id))
    .limit(1)
  const endMonth = settings?.endMonth ?? DEFAULT_COMPANY_SETTINGS.financialYearEndMonth

  // Every reconciliation of the account that has a statement linked, any year.
  const statements = await db
    .select({
      statementDate: recon.statementDate,
      uploadId: bankUpload.id,
      description: bankUpload.description,
      fileKey: bankUpload.fileUrl,
    })
    .from(recon)
    .innerJoin(bankUpload, eq(bankUpload.id, recon.bankUploadId))
    .where(and(eq(recon.bankAccountId, bankAccountId), isNotNull(recon.bankUploadId)))
    .orderBy(asc(recon.statementDate), asc(recon.id))
  if (statements.length === 0) {
    return {
      ok: false,
      status: 409,
      problem: "No statements have been uploaded and linked to a reconciliation for this account.",
    }
  }

  const yearMonths = monthsOfFinancialYear(endYear, endMonth)
  const firstIndex = index(monthOf(statements[0]!.statementDate))
  const lastIndex = index(monthOf(statements.at(-1)!.statementDate))
  const expected = yearMonths.filter(
    (month) => index(month) >= firstIndex && (!account_.isArchived || index(month) <= lastIndex),
  )
  if (expected.length === 0) {
    return {
      ok: false,
      status: 409,
      problem: "This account has no statements in that financial year.",
    }
  }

  const have = new Set(statements.map((s) => index(monthOf(s.statementDate))))
  const missing = expected.filter((month) => !have.has(index(month))).map(label)
  if (missing.length > 0) {
    return { ok: false, status: 409, problem: "Statements are missing.", missing }
  }

  // One file per upload, even if several reconciliations point at it.
  const inYear = new Set(yearMonths.map(index))
  const chosen = new Map<number, (typeof statements)[number]>()
  for (const statement of statements) {
    if (inYear.has(index(monthOf(statement.statementDate))) && !chosen.has(statement.uploadId)) {
      chosen.set(statement.uploadId, statement)
    }
  }

  const used = new Set<string>()
  const entries = await Promise.all(
    [...chosen.values()].map(async (statement) => {
      const extension = extname(statement.fileKey)
      const base = `${statement.statementDate} ${statement.description}`
        .replace(UNSAFE_FILE_NAME_CHARS, "-")
        .trim()
      return { statement, extension, base, data: await getFileBytes(statement.fileKey) }
    }),
  )
  const zipEntries = entries.map(({ statement, extension, base, data }) => {
    let name = base.toLowerCase().endsWith(extension.toLowerCase()) ? base : `${base}${extension}`
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = `${base} (${n})${extension}`
    }
    used.add(name.toLowerCase())
    return { name, data, modified: new Date(`${statement.statementDate}T12:00:00`) }
  })

  const fileName = `${account_.name} statements FY${endYear}.zip`.replace(
    UNSAFE_FILE_NAME_CHARS,
    "-",
  )
  return { ok: true, fileName, zip: createZip(zipEntries) }
}
