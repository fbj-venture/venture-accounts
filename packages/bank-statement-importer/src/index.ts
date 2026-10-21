// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./pdfjs-worker.d.ts" />
import type { Transaction } from "@app/models"
import { isStorageConfigured, uploadFile } from "@app/storage"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs"
import {
  findAccountByBankAccountNumber,
  importTransactions,
  recordBankUpload,
  type ImportRowProgress,
} from "./db-import.js"
import { extractAccountNumber, extractStatementDate, extractTableRows } from "./extractor.js"
import { extractFnb, isFnbStatement } from "./extractor-fnb.js"
import { extractHistory, isHistoryStatement, isoToStatementDate } from "./extractor-history.js"
import type { ImportRow } from "./import-row.js"
import { statementDateToIso, toTransactions } from "./transaction.js"
;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker

// Statements use PDF standard fonts (Helvetica etc.) without embedding them;
// pdf.js ships replacements in pdfjs-dist/standard_fonts/ but can't locate
// them on its own under Node, and warns "Ensure that the
// `standardFontDataUrl` API parameter is provided". Under Node it takes a
// plain directory path (passed straight to fs.readFile), which must end in
// "/" - a trailing backslash is rejected, so use forward slashes, which
// Windows accepts too.
//
// Computed lazily (not at module load) and tolerant of failure: a bundled
// server build inlines pdfjs-dist's code, so it's no longer a real,
// separately-resolvable package next to the built server, and this lookup
// fails there. Missing standard fonts only degrades text extraction for a
// statement that relies on them (same fallback pdfjs-dist itself already
// uses for its optional @napi-rs/canvas dependency) - it shouldn't take
// down every route that happens to import this module.
let standardFontDataUrl: string | undefined
let standardFontDataUrlResolved = false
function getStandardFontDataUrl(): string | undefined {
  if (!standardFontDataUrlResolved) {
    standardFontDataUrlResolved = true
    try {
      standardFontDataUrl =
        path
          .join(
            path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
            "standard_fonts",
          )
          .replaceAll("\\", "/") + "/"
    } catch {
      console.warn(
        "Couldn't locate pdfjs-dist's standard_fonts directory - PDF text extraction may be broken for statements that rely on non-embedded fonts.",
      )
    }
  }
  return standardFontDataUrl
}

export async function readPdfFileFromFile(filePath: string, userId: string): Promise<void> {
  console.log(filePath)

  const data = await readFile(filePath)
  await readPdfStream(data, userId)
}

// One event per phase of readPdfStreamWithProgress's pipeline, so a caller
// (e.g. a streaming HTTP handler) can report progress as it happens rather
// than waiting for the whole import to finish.
export type ImportEvent =
  | { phase: "extracting" }
  | {
      phase: "extracted"
      statementDate: string
      accountNumber: string
      rowCount: number
      /** Items left out because they are still pending at the bank (history layout only). */
      pendingSkipped?: number
    }
  | ({ phase: "importing" } & ImportRowProgress)
  | { phase: "done"; imported: number; skipped: number; total: number }

export async function readPdfStream(data: Uint8Array, userId: string): Promise<Transaction[]> {
  return readPdfStreamWithProgress(data, userId, () => {})
}

// What an upload is described as when the caller doesn't say.
export const DEFAULT_UPLOAD_DESCRIPTION = "Uploading bank statement"

// The PDFs a bank account can be imported from. "statement" is Standard
// Bank's official monthly statement; "history" is its Transaction History
// Statement downloaded from the bank's website at any time, which can include
// transactions that are not on a monthly statement yet; "fnb" is an FNB
// statement. All give the same import hash for the same transaction (see
// canonical-hash.ts), so a transaction imported from one is skipped when it
// turns up in another.
export type PdfLayout = "statement" | "history" | "fnb"

// userId is the signed-in user the imported entries are attributed to
// (createdBy/updatedBy). options.description is saved with the uploaded PDF
// (see storeStatementPdf).
export async function readPdfStreamWithProgress(
  data: Uint8Array,
  userId: string,
  onEvent: (event: ImportEvent) => void,
  options: { description?: string; layout?: PdfLayout } = {},
): Promise<Transaction[]> {
  onEvent({ phase: "extracting" })

  const bytes = new Uint8Array(data)
  const extracted =
    options.layout === "history"
      ? await extractHistoryPdf(bytes)
      : options.layout === "fnb"
        ? await extractFnbPdf(bytes)
        : await extractStatementPdf(bytes)
  const { accountNumber, statementDate, transactions } = extracted

  // Find the Bank Account
  const accountDetails = await findAccountByBankAccountNumber(accountNumber)
  if (!accountDetails.found || !accountDetails.account) {
    throw new Error(`Could not fund the Bank-Account or Account for '${accountNumber}'`)
  }

  onEvent({
    phase: "extracted",
    statementDate,
    accountNumber,
    rowCount: transactions.length,
    ...(extracted.pendingSkipped ? { pendingSkipped: extracted.pendingSkipped } : {}),
  })

  await storeStatementPdf(data, {
    bankId: accountDetails.account.id,
    accountNumber,
    fileName: extracted.fileName(data),
    userId,
    description: options.description?.trim() || DEFAULT_UPLOAD_DESCRIPTION,
  })

  let imported = 0
  let skipped = 0

  await importTransactions(transactions, accountDetails.account, userId, (progress) => {
    if (progress.status === "imported") {
      imported++
    } else {
      skipped++
    }
    onEvent({ phase: "importing", ...progress })
  })

  onEvent({ phase: "done", imported, skipped, total: transactions.length })

  return transactions
}

// Keeps the original statement PDF in file storage (still password
// protected, exactly as uploaded) and records it as a bank upload, so an
// imported entry can be traced back to its source document. Stored at
// statements/<accountNumber>/<fileName>, named so that re-importing the same
// statement overwrites rather than duplicates (see extractStatementPdf and
// extractHistoryPdf for the names). Skipped
// when storage isn't configured; a failed upload fails the import, so a
// stored file and the entries it produced never disagree.
async function storeStatementPdf(
  data: Uint8Array,
  statement: {
    bankId: number
    accountNumber: string
    fileName: string
    userId: string
    description: string
  },
): Promise<void> {
  if (!isStorageConfigured()) {
    return
  }
  const folder = statement.accountNumber.replace(/[^0-9A-Za-z-]/g, "")
  const key = `statements/${folder}/${statement.fileName}`
  await uploadFile(key, data, "application/pdf")
  await recordBankUpload(
    statement.bankId,
    key,
    createHash("sha256").update(data).digest("hex"),
    statement.description,
    statement.userId,
  )
}

// What either layout is read into, ready to import.
type ExtractedPdf = {
  accountNumber: string
  /** Shown in progress messages, e.g. "12 March 2024". */
  statementDate: string
  transactions: Transaction[]
  pendingSkipped?: number
  /** Where the PDF is kept under the account's folder in file storage. */
  fileName: (data: Uint8Array) => string
}

// The official monthly statement. Named by its statement date, one per month.
async function extractStatementPdf(data: Uint8Array): Promise<ExtractedPdf> {
  // pdf.js takes over the bytes it is given, so every read gets its own copy.
  const { rows, statementDate, accountNumber } = await extractTextFromPdf(new Uint8Array(data))

  if (!statementDate || !accountNumber) {
    // Say so when it is the other layout, rather than a vague "not found".
    const pages = await readPageItems(data, 1)
    if (pages[0] && isHistoryStatement(pages[0])) {
      throw new Error(
        'This is a "Transaction History Statement". Import it with "Standard Bank Transaction History PDF" instead.',
      )
    }
    if (pages[0] && isFnbStatement(pages[0])) {
      throw new Error(
        'This is an FNB statement. Import it with "Unverified FNB Statement" instead.',
      )
    }
  }
  if (!statementDate) {
    throw new Error("Could not find the statement date on the first page.")
  }
  if (!accountNumber) {
    throw new Error("Could not find the account number on the first page.")
  }

  return {
    accountNumber,
    statementDate,
    transactions: toTransactions(rows, statementDate, accountNumber),
    fileName: () => `${statementDateToIso(statementDate)}.pdf`,
  }
}

// A Transaction History Statement. Several can be downloaded for the same
// account on one day, and later ones replace nothing, so each is named by the
// last day it covers plus a short fingerprint of its contents.
async function extractHistoryPdf(data: Uint8Array): Promise<ExtractedPdf> {
  const history = extractHistory(await readPageItems(data))

  return {
    accountNumber: history.accountNumber,
    statementDate: isoToStatementDate(history.rangeEnd),
    transactions: history.transactions,
    pendingSkipped: history.pendingCount,
    fileName: (bytes) =>
      `ad-hoc/${history.rangeEnd}-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}.pdf`,
  }
}

// An FNB statement. Named by its statement date, one per statement.
async function extractFnbPdf(data: Uint8Array): Promise<ExtractedPdf> {
  const fnb = extractFnb(await readPageItems(data))

  return {
    accountNumber: fnb.accountNumber,
    statementDate: isoToStatementDate(fnb.statementDate),
    transactions: fnb.transactions,
    fileName: () => `${fnb.statementDate}.pdf`,
  }
}

// The text of each page (or just the first `limit`).
async function readPageItems(data: Uint8Array, limit = Infinity) {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: getStandardFontDataUrl(),
  })
  const pdf = await loadingTask.promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, limit); pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    pages.push((await page.getTextContent()).items)
  }
  await loadingTask.destroy()
  return pages
}

async function extractTextFromPdf(
  data: Uint8Array,
): Promise<{ rows: ImportRow[]; statementDate: string | null; accountNumber: string | null }> {
  const loadingTask = getDocument({ data, standardFontDataUrl: getStandardFontDataUrl() })
  const pdf = await loadingTask.promise

  const rows: ImportRow[] = []
  let statementDate: string | null = null
  let accountNumber: string | null = null

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()

    if (pageNumber === 1) {
      statementDate = extractStatementDate(content.items)
      accountNumber = extractAccountNumber(content.items)
    }

    rows.push(...extractTableRows(content.items, rows.length))
  }

  await loadingTask.destroy()

  return { rows, statementDate, accountNumber }
}
