import type { Transaction } from "@app/models";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
process.loadEnvFile(rootEnvPath);

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
   const loadingTask = getDocument({ data });
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

/**
 * Used for running this file as a script and passing in a file path
 */
const isRunDirectly =
   process.argv[1] !== undefined &&
   import.meta.url === pathToFileURL(process.argv[1]).href;

if (isRunDirectly) {
   const filePath = process.argv.slice(2).find((arg) => arg !== "--");
   if (!filePath) {
      console.error("Usage: pnpm read-pdf -- <path-to-pdf>");
      process.exit(1);
   }

   await readPdfFileFromFile(filePath);
}
