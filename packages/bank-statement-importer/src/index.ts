import type { Transaction } from "@app/models";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
   findAccountByBankAccountNumber,
   importTransactions,
   type ImportRowProgress,
} from "./db-import.js";
import { extractAccountNumber, extractStatementDate, extractTableRows } from "./extractor.js";
import type { ImportRow } from "./import-row.js";
import { toTransactions } from "./transaction.js";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which directory this is run from.
const rootEnvPath = path.resolve(
   path.dirname(fileURLToPath(import.meta.url)),
   "../../../.env",
);
try {
   process.loadEnvFile(rootEnvPath);
} catch (error) {
   // No .env file to load - fine in production, where the platform injects
   // real env vars directly. Also covers a bundled build, where this
   // module's location - and so the relative path above - no longer
   // matches the source layout at all.
   if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
   }
}

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

export async function readPdfFileFromFile(filePath: string): Promise<void> {
   console.log(filePath);

   const data = await readFile(filePath);
   await readPdfStream(data);
}

// One event per phase of readPdfStreamWithProgress's pipeline, so a caller
// (e.g. a streaming HTTP handler) can report progress as it happens rather
// than waiting for the whole import to finish.
export type ImportEvent =
   | { phase: "extracting" }
   | { phase: "extracted"; statementDate: string; accountNumber: string; rowCount: number }
   | ({ phase: "importing" } & ImportRowProgress)
   | { phase: "done"; imported: number; skipped: number; total: number };

export async function readPdfStream(data: Uint8Array): Promise<Transaction[]> {
   return readPdfStreamWithProgress(data, () => { });
}

export async function readPdfStreamWithProgress(
   data: Uint8Array,
   onEvent: (event: ImportEvent) => void,
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

   let imported = 0;
   let skipped = 0;

   await importTransactions(transactions, accountDetails.account, (progress) => {
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
