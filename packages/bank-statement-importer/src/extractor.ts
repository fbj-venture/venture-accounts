import { createHash } from "node:crypto";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ImportRow } from "./import-row.js";

type TextContentItem = Awaited<
  ReturnType<PDFPageProxy["getTextContent"]>
>["items"][number];

const HEADER_PATTERN =
  /Details\s+Service\s+Fee\s+Debits\s+Credits\s+Date\s+Balance/;

const TABLE_END_MARKER =
  "Please verify all transactions reflected on this statement and notify";

const BALANCE_BROUGHT_FORWARD_PREFIX = "BALANCE BROUGHT FORWARD";

// e.g. "12,662.23" or "1,132.83-" (trailing "-" marks a debit).
const AMOUNT_PATTERN = /^[\d,]+\.\d{2}-?$/;

// e.g. "02 12" (day, month).
const DATE_PATTERN = /^\d{2}\s\d{2}$/;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The statement date on the first page stands alone on its own line, e.g.
// "12 March 2024" (dd MMMM yyyy).
const STATEMENT_DATE_PATTERN = new RegExp(
  `^\\d{1,2}\\s+(?:${MONTH_NAMES.join("|")})\\s+\\d{4}$`,
);

// e.g. "Account Number   42 028 703 5" - the digits are space-separated in
// the source and get joined back together.
const ACCOUNT_NUMBER_PATTERN = /Account Number\s+([\d ]+\d)/;

type ParsedTransactionLine = Omit<ImportRow, "hash">;

function buildLines(items: TextContentItem[]): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (const item of items) {
    if (!("str" in item)) {
      continue;
    }

    currentLine += item.str;

    if (item.hasEOL) {
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += " ";
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

// Extracts the statement date (dd MMMM yyyy, e.g. "12 March 2024") from the
// header section of the first page.
export function extractStatementDate(items: TextContentItem[]): string | null {
  const lines = buildLines(items);

  for (const line of lines) {
    const trimmed = line.trim();
    if (STATEMENT_DATE_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

// Extracts the bank account number (e.g. "420287035") from the header
// section of the first page, with spaces between the digits removed. It
// usually sits on the same line as "Account Number", but falls back to
// checking the next line too in case it wraps.
export function extractAccountNumber(items: TextContentItem[]): string | null {
  const lines = buildLines(items);

  for (let i = 0; i < lines.length; i++) {
    const singleLineMatch = ACCOUNT_NUMBER_PATTERN.exec(lines[i] ?? "");
    if (singleLineMatch) {
      return (singleLineMatch[1] ?? "").replace(/\s+/g, "");
    }

    const combinedLine = `${lines[i] ?? ""} ${lines[i + 1] ?? ""}`;
    const combinedMatch = ACCOUNT_NUMBER_PATTERN.exec(combinedLine);
    if (combinedMatch) {
      return (combinedMatch[1] ?? "").replace(/\s+/g, "");
    }
  }

  return null;
}

function isHeaderLine(line: string): boolean {
  return HEADER_PATTERN.test(line);
}

// The "Service Fee" header can wrap onto the next line inside its narrow
// column (e.g. "Details   Service" / "Fee   Debits   Credits   Date   Balance"),
// so the header is searched for across each line and, failing that, each
// adjacent pair of lines joined together.
function locateHeader(lines: string[]): { bodyStartIndex: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (isHeaderLine(lines[i] ?? "")) {
      return { bodyStartIndex: i + 1 };
    }

    const combinedLine = `${lines[i] ?? ""} ${lines[i + 1] ?? ""}`;
    if (isHeaderLine(combinedLine)) {
      return { bodyStartIndex: i + 2 };
    }
  }

  return null;
}

// A footnote marker the bank prints in an amount's place, e.g.
// "DEBIT CARD PURCHASE FEE   ##   4.50-   02 26   27,535.30" - it means
// there's no amount there, same as an absent/blank field.
const NO_AMOUNT_PLACEHOLDER = "##";

function normalizeAmount(token: string): string {
  return token === NO_AMOUNT_PLACEHOLDER ? "" : token;
}

// A transaction's first line always ends with a date and a balance, e.g.
// "CHEQUE CARD PURCHASE   4.20   13.50-   02 14   22,648.73". Between the
// leading Details and the trailing Date/Balance there are 0-2 amount
// fields: when there are 2, the first is the (always positive) Service Fee
// and the second is the Debit/Credit; when there's 1, it's the Debit/Credit
// on its own. A trailing "-" marks a Debit; its absence marks a Credit.
function parseTransactionLine(line: string): ParsedTransactionLine | null {
  const tokens = line.trim().split(/\s{2,}/).filter((token) => token.length > 0);
  if (tokens.length < 3) {
    return null;
  }

  const balance = tokens[tokens.length - 1] ?? "";
  const date = tokens[tokens.length - 2] ?? "";
  if (!AMOUNT_PATTERN.test(balance) || !DATE_PATTERN.test(date)) {
    return null;
  }

  const details = tokens[0] ?? "";
  const amountTokens = tokens.slice(1, tokens.length - 2);

  let serviceFee = "";
  let debits = "";
  let credits = "";

  if (amountTokens.length === 2) {
    serviceFee = normalizeAmount(amountTokens[0] ?? "");
    const amount = normalizeAmount(amountTokens[1] ?? "");
    if (amount.endsWith("-")) {
      debits = amount;
    } else {
      credits = amount;
    }
  } else if (amountTokens.length === 1) {
    const amount = normalizeAmount(amountTokens[0] ?? "");
    if (amount.endsWith("-")) {
      debits = amount;
    } else {
      credits = amount;
    }
  }

  return { details, serviceFee, debits, credits, date, balance };
}

function hashRow(row: ParsedTransactionLine): string {
  const canonical = [
    row.details,
    row.serviceFee,
    row.debits,
    row.credits,
    row.date,
    row.balance,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

function toImportRow(transaction: ParsedTransactionLine): ImportRow {
  return { ...transaction, hash: hashRow(transaction) };
}

export function extractTableRows(items: TextContentItem[]): ImportRow[] {
  const lines = buildLines(items);

  const header = locateHeader(lines);
  if (!header) {
    return [];
  }

  let i = header.bodyStartIndex;

  // The row immediately after the header is a running total, not a
  // transaction.
  if ((lines[i]?.trim() ?? "").startsWith(BALANCE_BROUGHT_FORWARD_PREFIX)) {
    i += 1;
  }

  const rows: ImportRow[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";

    if (line.startsWith(TABLE_END_MARKER)) {
      // Ignore everything after the end of the table.
      break;
    }

    if (line.length === 0) {
      continue;
    }

    const transaction = parseTransactionLine(line);
    if (!transaction) {
      continue;
    }

    // Details can wrap onto a second, purely descriptive line with no
    // date/amount fields of its own - fold it into this transaction.
    const nextLine = lines[i + 1]?.trim() ?? "";
    const isContinuation =
      nextLine.length > 0 &&
      !nextLine.startsWith(TABLE_END_MARKER) &&
      parseTransactionLine(nextLine) === null;

    if (isContinuation) {
      transaction.details = `${transaction.details} ${nextLine}`.trim();
      i += 1;
    }

    rows.push(toImportRow(transaction));
  }

  return rows;
}
