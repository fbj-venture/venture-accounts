import type { Transaction } from "@app/models";
import { isStorageConfigured, uploadFile } from "@app/storage";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import {
   findAccountByBankAccountNumber,
   importTransactions,
   recordBankUpload,
   type ImportRowProgress,
} from "./db-import.js";
import { extractAccountNumber, extractStatementDate, extractTableRows } from "./extractor.js";
import type { ImportRow } from "./import-row.js";
import { statementDateToIso, toTransactions } from "./transaction.js";

// In Node, pdf.js normally runs a "fake worker" in-process rather than a
// real Worker thread - but it locates that worker code by dynamically
// import()-ing GlobalWorkerOptions.workerSrc (a bare "./pdf.worker.mjs"),
// which only resolves next to a real, installed pdfjs-dist package. A
// bundled server build inlines pdf.mjs's own code but has no such file on
// disk, so that import fails ("Cannot find module ... pdf.worker.mjs").
// Statically importing the worker module ourselves gets it bundled
// alongside pdf.mjs, and stashing it on globalThis.pdfjsWorker is pdf.js's
// own documented escape hatch (see PDFWorker.#mainThreadWorkerMessageHandler
// upstream) for skipping that dynamic import entirely.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

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
let standardFontDataUrl: string | undefined;
let standardFontDataUrlResolved = false;
function getStandardFontDataUrl(): string | undefined {
   if (!standardFontDataUrlResolved) {
      standardFontDataUrlResolved = true;
      try {
         standardFontDataUrl =
            path
               .join(
                  path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")),
                  "standard_fonts",
               )
               .replaceAll("\\", "/") + "/";
      } catch {
         console.warn(
            "Couldn't locate pdfjs-dist's standard_fonts directory - PDF text extraction may be broken for statements that rely on non-embedded fonts.",
         );
      }
   }
   return standardFontDataUrl;
}

export async function readPdfFileFromFile(filePath: string, userId: string): Promise<void> {
   console.log(filePath);

   const data = await readFile(filePath);
   await readPdfStream(data, userId);
}

// One event per phase of readPdfStreamWithProgress's pipeline, so a caller
// (e.g. a streaming HTTP handler) can report progress as it happens rather
// than waiting for the whole import to finish.
export type ImportEvent =
   | { phase: "extracting" }
   | { phase: "extracted"; statementDate: string; accountNumber: string; rowCount: number }
   | ({ phase: "importing" } & ImportRowProgress)
   | { phase: "done"; imported: number; skipped: number; total: number };

export async function readPdfStream(data: Uint8Array, userId: string): Promise<Transaction[]> {
   return readPdfStreamWithProgress(data, userId, () => { });
}

// What an upload is described as when the caller doesn't say.
export const DEFAULT_UPLOAD_DESCRIPTION = "Uploading bank statement";

// userId is the signed-in user the imported entries are attributed to
// (createdBy/updatedBy). options.description is saved with the uploaded PDF
// (see storeStatementPdf).
export async function readPdfStreamWithProgress(
   data: Uint8Array,
   userId: string,
   onEvent: (event: ImportEvent) => void,
   options: { description?: string } = {},
): Promise<Transaction[]> {
   onEvent({ phase: "extracting" });

   const { rows, statementDate, accountNumber } = await extractTextFromPdf(
      new Uint8Array(data),
   );

   if (!statementDate) {
      throw new Error("Could not find the statement date on the first page.");
   }
   if (!accountNumber) {
      throw new Error("Could not find the account number on the first page.");
   }

   // Find the Bank Account
   const accountDetails = await findAccountByBankAccountNumber(accountNumber);
   if (!accountDetails.found || !accountDetails.account) {
      throw new Error(`Could not fund the Bank-Account or Account for '${accountNumber}'`);
   }

   const transactions = toTransactions(rows, statementDate);

   onEvent({
      phase: "extracted",
      statementDate,
      accountNumber,
      rowCount: transactions.length,
   });

   await storeStatementPdf(data, {
      bankId: accountDetails.account.id,
      accountNumber,
      statementDate,
      userId,
      description: options.description?.trim() || DEFAULT_UPLOAD_DESCRIPTION,
   });

   let imported = 0;
   let skipped = 0;

   await importTransactions(transactions, accountDetails.account, userId, (progress) => {
      if (progress.status === "imported") {
         imported++;
      } else {
         skipped++;
      }
      onEvent({ phase: "importing", ...progress });
   });

   onEvent({ phase: "done", imported, skipped, total: transactions.length });

   return transactions;
}

// Keeps the original statement PDF in file storage (still password
// protected, exactly as uploaded) and records it as a bank upload, so an
// imported entry can be traced back to its source document. Stored at
// statements/<accountNumber>/<yyyy-MM-dd>.pdf by the statement date, so
// re-importing the same statement overwrites rather than duplicates. Skipped
// when storage isn't configured; a failed upload fails the import, so a
// stored file and the entries it produced never disagree.
async function storeStatementPdf(
   data: Uint8Array,
   statement: {
      bankId: number;
      accountNumber: string;
      statementDate: string;
      userId: string;
      description: string;
   },
): Promise<void> {
   if (!isStorageConfigured()) {
      return;
   }
   const folder = statement.accountNumber.replace(/[^0-9A-Za-z-]/g, "");
   const key = `statements/${folder}/${statementDateToIso(statement.statementDate)}.pdf`;
   await uploadFile(key, data, "application/pdf");
   await recordBankUpload(
      statement.bankId,
      key,
      createHash("sha256").update(data).digest("hex"),
      statement.description,
      statement.userId,
   );
}

async function extractTextFromPdf(
   data: Uint8Array,
): Promise<{ rows: ImportRow[]; statementDate: string | null; accountNumber: string | null; }> {
   const loadingTask = getDocument({ data, standardFontDataUrl: getStandardFontDataUrl() });
   const pdf = await loadingTask.promise;

   const rows: ImportRow[] = [];
   let statementDate: string | null = null;
   let accountNumber: string | null = null;

   for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      if (pageNumber === 1) {
         statementDate = extractStatementDate(content.items);
         accountNumber = extractAccountNumber(content.items);
      }

      rows.push(...extractTableRows(content.items, rows.length));
   }

   await loadingTask.destroy();

   return { rows, statementDate, accountNumber };
}
