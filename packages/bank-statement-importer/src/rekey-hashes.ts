// One-off: gives every imported Journal Line the canonical import hash (see
// canonical-hash.ts) by matching it to the statement PDFs it came from.
//
// Why PDFs and not the database's own dates: lines imported before commit
// 9f5623a (2026-10-08) were stored one day early (a time zone bug), so a hash
// rebuilt from the stored date would never match a fresh import of the same
// statement. The PDFs have the true dates.
//
// For each PDF row it computes the true hash, then finds the stored line for
// the same account and amount whose date is the true date (lines imported
// since the fix) or one day earlier (lines imported before it), preferring
// whichever fits the line's import time. Lines are paired in id order for
// rows that share an account, date and amount, which is the order they were
// imported. A line that only fits the other offset is matched too but listed
// as unexpected, so you can look at it.
//
// Dates are not changed; only import_hash is.
//
// Usage: pnpm script src/rekey-hashes.ts [-- --apply] [--data <folder>] [--user <email>]
// Without --apply it only reports. With it, the old hashes are first saved to
// data/import-hash-backup-<timestamp>.json and then every changed line is
// updated in one transaction.
import { bankAccount, db, journal, journalLine, user, withUpdate } from "@app/db/direct"
import { eq, isNotNull } from "drizzle-orm"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs"
import { occurrenceNumbers, toCents, toIsoDate } from "./canonical-hash.js"
import { extractAccountNumber, extractStatementDate, extractTableRows } from "./extractor.js"
import { toTransactions } from "./transaction.js"
;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker

// When the time zone fix went in (commit 9f5623a). Lines created before it
// are expected to be stored a day early.
const FIX_DEPLOYED_AT = new Date("2026-10-08T15:13:51Z")

const DEFAULT_USER_EMAIL = "francis@venturechurch.co.za"

const args = process.argv.slice(2).filter((arg) => arg !== "--")
const apply = args.includes("--apply")
const optionValue = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const dataFolder = path.resolve(optionValue("--data") ?? "../../data")
const email = optionValue("--user") ?? DEFAULT_USER_EMAIL

type TrueRow = {
  hash: string
  accountNumber: string
  isoDate: string
  cents: number
  occurrence: number
  file: string
}
type StoredLine = {
  id: number
  oldHash: string
  accountNumber: string
  isoDate: string
  cents: number
  expectedOffset: 0 | 1
}

function previousDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return toIsoDate(date)
}

async function findPdfs(folder: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await findPdfs(full)))
    } else if (entry.name.toLowerCase().endsWith(".pdf")) {
      found.push(full)
    }
  }
  return found.sort()
}

// 1. The true rows, from every readable PDF. The same transaction can appear
// in several files (overlapping or duplicated statements); its hash is the
// same each time, so it is kept once.
const trueRows = new Map<string, TrueRow>()
const unreadable: string[] = []
const pdfPaths = await findPdfs(dataFolder)
for (const pdfPath of pdfPaths) {
  const label = path.relative(dataFolder, pdfPath)
  try {
    const loadingTask = getDocument({ data: new Uint8Array(await readFile(pdfPath)) })
    const pdf = await loadingTask.promise
    const rows = []
    let statementDate: string | null = null
    let accountNumber: string | null = null
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent()
      if (pageNumber === 1) {
        statementDate = extractStatementDate(content.items)
        accountNumber = extractAccountNumber(content.items)
      }
      rows.push(...extractTableRows(content.items, rows.length))
    }
    await loadingTask.destroy()
    if (!statementDate || !accountNumber) {
      unreadable.push(`${label} (no statement date or account number)`)
      continue
    }
    const transactions = toTransactions(rows, statementDate, accountNumber)
    const occurrences = occurrenceNumbers(
      transactions,
      (transaction) => `${toIsoDate(transaction.date)}|${toCents(transaction.amount)}`,
    )
    for (const [index, transaction] of transactions.entries()) {
      if (!trueRows.has(transaction.hash)) {
        trueRows.set(transaction.hash, {
          hash: transaction.hash,
          accountNumber,
          isoDate: toIsoDate(transaction.date),
          cents: toCents(transaction.amount),
          occurrence: occurrences[index]!,
          file: label,
        })
      }
    }
  } catch (error) {
    unreadable.push(`${label} (${error instanceof Error ? error.message : String(error)})`)
  }
}

// Rows sharing an account, date and amount are paired with lines in
// occurrence order, which is the order they were imported.
const groupKey = (row: { accountNumber: string; isoDate: string; cents: number }) =>
  `${row.accountNumber}|${row.isoDate}|${row.cents}`
const trueByGroup = new Map<string, TrueRow[]>()
for (const row of trueRows.values()) {
  trueByGroup.set(groupKey(row), [...(trueByGroup.get(groupKey(row)) ?? []), row])
}
for (const group of trueByGroup.values()) {
  group.sort((a, b) => a.occurrence - b.occurrence)
}

// 2. The stored lines.
const stored: StoredLine[] = (
  await db
    .select({
      id: journalLine.id,
      oldHash: journalLine.hash,
      amount: journalLine.amount,
      date: journal.date,
      statementDate: journalLine.statementDate,
      createdAt: journalLine.createdAt,
      accountNumber: bankAccount.accountNumber,
    })
    .from(journalLine)
    .innerJoin(journal, eq(journal.id, journalLine.journalEntryId))
    .innerJoin(bankAccount, eq(bankAccount.id, journalLine.accountId))
    .where(isNotNull(journalLine.hash))
    .orderBy(journalLine.id)
).map((line) => ({
  id: line.id,
  oldHash: line.oldHash!,
  accountNumber: line.accountNumber,
  isoDate: toIsoDate(line.statementDate ?? line.date),
  cents: toCents(line.amount),
  expectedOffset: line.createdAt < FIX_DEPLOYED_AT ? 1 : 0,
}))

// 3. Pair them. Pass 1 uses each line's expected offset; pass 2 lets leftover
// rows take a leftover line at the other offset.
const claimed = new Map<number, { row: TrueRow; unexpectedOffset: boolean }>()
const storedByGroup = new Map<string, StoredLine[]>()
for (const line of stored) {
  const key = `${line.accountNumber}|${line.cents}`
  storedByGroup.set(key, [...(storedByGroup.get(key) ?? []), line])
}

function pair(offsetMode: "expected" | "other") {
  for (const group of trueByGroup.values()) {
    for (const row of group) {
      if ([...claimed.values()].some((claim) => claim.row.hash === row.hash)) continue
      const candidates = storedByGroup.get(`${row.accountNumber}|${row.cents}`) ?? []
      const line = candidates.find((candidate) => {
        if (claimed.has(candidate.id)) return false
        const offset =
          candidate.isoDate === row.isoDate
            ? 0
            : candidate.isoDate === previousDay(row.isoDate)
              ? 1
              : null
        if (offset === null) return false
        return offsetMode === "expected" ? offset === candidate.expectedOffset : true
      })
      if (line) claimed.set(line.id, { row, unexpectedOffset: offsetMode === "other" })
    }
  }
}
pair("expected")
pair("other")

// 4. Report.
const changes = [...claimed.entries()]
  .map(([id, claim]) => ({
    id,
    oldHash: stored.find((line) => line.id === id)!.oldHash,
    newHash: claim.row.hash,
  }))
  .filter((change) => change.oldHash !== change.newHash)
const unexpected = [...claimed.entries()].filter(([, claim]) => claim.unexpectedOffset)
const unmatchedLines = stored.filter((line) => !claimed.has(line.id))
const matchedHashes = new Set([...claimed.values()].map((claim) => claim.row.hash))
const unmatchedRows = [...trueRows.values()].filter((row) => !matchedHashes.has(row.hash))

console.log(`PDFs read: ${pdfPaths.length - unreadable.length} of ${pdfPaths.length}`)
for (const entry of unreadable) console.log(`  unreadable: ${entry}`)
console.log(`Distinct transactions across the PDFs: ${trueRows.size}`)
console.log(`Stored imported lines: ${stored.length}`)
console.log(`  matched to a PDF row: ${claimed.size} (${changes.length} need a new hash)`)
console.log(`  matched at an unexpected date offset: ${unexpected.length}`)
for (const [id, claim] of unexpected.slice(0, 10)) {
  const line = stored.find((candidate) => candidate.id === id)!
  console.log(
    `    line ${id}: stored ${line.isoDate}, PDF ${claim.row.isoDate} (${claim.row.file})`,
  )
}
console.log(`  not matched to any PDF row (keep their current hash): ${unmatchedLines.length}`)
for (const line of unmatchedLines.slice(0, 10)) {
  console.log(`    line ${line.id}: ${line.accountNumber} ${line.isoDate} ${line.cents / 100}`)
}
console.log(`PDF rows with no stored line (statement not imported yet): ${unmatchedRows.length}`)
const rowsPerFile = new Map<string, { total: number; unmatched: number }>()
for (const row of trueRows.values()) {
  const entry = rowsPerFile.get(row.file) ?? { total: 0, unmatched: 0 }
  entry.total++
  if (!matchedHashes.has(row.hash)) entry.unmatched++
  rowsPerFile.set(row.file, entry)
}
for (const [file, { total, unmatched }] of rowsPerFile) {
  if (unmatched > 0) {
    console.log(
      `    ${file}: ${unmatched} of ${total} rows${unmatched < total ? "  <-- partly imported" : ""}`,
    )
  }
}

if (!apply) {
  console.log("Dry run only. Re-run with --apply to write.")
  process.exit(0)
}

const [importer] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
if (!importer) {
  console.error(`No user with email ${email}.`)
  process.exit(1)
}

const backupPath = path.resolve(
  dataFolder,
  `import-hash-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
)
await mkdir(path.dirname(backupPath), { recursive: true })
await writeFile(
  backupPath,
  JSON.stringify(
    stored.map(({ id: lineId, oldHash }) => ({ id: lineId, oldHash })),
    null,
    2,
  ),
)
console.log(`Old hashes saved to ${backupPath}`)

await db.transaction(async (tx) => {
  for (const change of changes) {
    await tx
      .update(journalLine)
      .set(withUpdate(importer.id, { hash: change.newHash }))
      .where(eq(journalLine.id, change.id))
  }
})
console.log(`Updated ${changes.length} lines.`)
process.exit(0)
