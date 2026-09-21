import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractAccountNumber, extractStatementDate, extractTableRows } from "./extractor.js";
import type { ImportRow } from "./import-row.js";
import { toJson } from "./json.js";
import { toTransactions } from "./transaction.js";

// Loaded by path (rather than the default cwd-relative lookup) so this
// works regardless of which directory this is run from.
const rootEnvPath = path.resolve(
   path.dirname(fileURLToPath(import.meta.url)),
   "../../../.env",
);
process.loadEnvFile(rootEnvPath);

export async function readPdfFile(filePath: string): Promise<void> {
   console.log(filePath);

   const data = await readFile(filePath);
   const { rows, statementDate, accountNumber } = await extractTextFromPdf(
      new Uint8Array(data),
   );

   if (!statementDate) {
      throw new Error("Could not find the statement date on the first page.");
   }

   if (!accountNumber) {
      throw new Error("Could not find the account number on the first page.");
   }

   console.log(`Statement for account number: ${accountNumber}, on ${statementDate}`);
   

   const transactions = toTransactions(rows, statementDate);
   console.log(`Parsed ${transactions.length} transactions`);

   const jsonPath = filePath.replace(/\.pdf$/i, ".json");
   await writeFile(jsonPath, toJson(transactions));
   console.log(`Wrote ${transactions.length} transactions to ${jsonPath}`);
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

      rows.push(...extractTableRows(content.items));
   }

   await loadingTask.destroy();

   return { rows, statementDate, accountNumber };
}

const isRunDirectly =
   process.argv[1] !== undefined &&
   import.meta.url === pathToFileURL(process.argv[1]).href;

if (isRunDirectly) {
   const filePath = process.argv.slice(2).find((arg) => arg !== "--");
   if (!filePath) {
      console.error("Usage: pnpm read-pdf -- <path-to-pdf>");
      process.exit(1);
   }

   await readPdfFile(filePath);
}
