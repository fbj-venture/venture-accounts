// One-off: gives every imported Journal Line the canonical import hash (see
// canonical-hash.ts), rebuilt from what the database holds - for a database
// where the statement PDFs aren't available (see rekey-hashes.ts for the
// version that matches against them).
//
// A line imported before the time zone fix (commit 9f5623a, 2026-10-08
// 17:13:51 +0200) was stored one day early, so its true date is its stored
// date plus one day. `--fixed-at` is the moment THIS database started
// importing with the fix, i.e. when that code was deployed to it; lines
// created before then are moved forward a day for the hash, lines created
// after it are used as stored. (Dates themselves are not changed - only
// import_hash.)
//
// Each hash is then account number + true date + signed cents + occurrence,
// where occurrence counts lines sharing those three in id order, which is the
// order they were imported.
//
// Limits: a line whose date was edited after import is hashed from the edited
// date, so it may not match a fresh import of its statement. The dry run
// can't see those.
//
// Usage: pnpm script src/backfill-hashes.ts -- --fixed-at <ISO timestamp> [--apply] [--user <email>]
// Without --apply it only reports (including how many lines were created in
// each hour around --fixed-at, to help confirm the timestamp). With it, the
// old hashes are first saved to data/import-hash-backup-<timestamp>.json and
// then everything is updated in one transaction.
import { bankAccount, db, journal, journalLine, user, withUpdate } from "@app/db/direct"
import { eq, isNotNull } from "drizzle-orm"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  canonicalHash,
  HASH_VERSION,
  occurrenceNumbers,
  toCents,
  toIsoDate,
} from "./canonical-hash.js"

const DEFAULT_USER_EMAIL = "francis@venturechurch.co.za"
const DAY_MS = 24 * 60 * 60 * 1000

const args = process.argv.slice(2).filter((arg) => arg !== "--")
const apply = args.includes("--apply")
const optionValue = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const email = optionValue("--user") ?? DEFAULT_USER_EMAIL

const fixedAtText = optionValue("--fixed-at")
const fixedAt = fixedAtText ? new Date(fixedAtText) : null
if (!fixedAt || Number.isNaN(fixedAt.getTime())) {
  console.error(
    'Pass --fixed-at <ISO timestamp with zone>, e.g. --fixed-at "2026-10-08T15:13:51Z": when the date fix was deployed to THIS database.',
  )
  process.exit(1)
}

const lines = await db
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
  .leftJoin(bankAccount, eq(bankAccount.id, journalLine.accountId))
  .where(isNotNull(journalLine.hash))
  .orderBy(journalLine.id)

// An imported line should always sit on a bank account; anything else can't be
// rebuilt, so it's reported and left alone.
const hashable = lines.filter(
  (line): line is typeof line & { accountNumber: string } => line.accountNumber !== null,
)
const unhashable = lines.filter((line) => line.accountNumber === null)

const preFix = (line: (typeof hashable)[number]) => line.createdAt < fixedAt
const trueDate = (line: (typeof hashable)[number]) => {
  const stored = line.statementDate ?? line.date
  return toIsoDate(preFix(line) ? new Date(stored.getTime() + DAY_MS) : stored)
}

const occurrences = occurrenceNumbers(
  hashable,
  (line) => `${line.accountNumber}|${trueDate(line)}|${toCents(line.amount)}`,
)

const updates = hashable.map((line, index) => ({
  id: line.id,
  oldHash: line.oldHash!,
  newHash: canonicalHash({
    accountNumber: line.accountNumber,
    isoDate: trueDate(line),
    cents: toCents(line.amount),
    occurrence: occurrences[index]!,
  }),
}))

const newHashes = new Set(updates.map((update) => update.newHash))
const collisions = updates.length - newHashes.size
const repeated = occurrences.filter((occurrence) => occurrence > 1).length
const changed = updates.filter((update) => update.oldHash !== update.newHash)

console.log(`Hash version: ${HASH_VERSION}`)
console.log(`Fix deployed at: ${fixedAt.toISOString()}`)
console.log(`Imported lines found: ${lines.length}`)
console.log(
  `  created before the fix (date moved forward a day): ${hashable.filter(preFix).length}`,
)
console.log(
  `  created after the fix (date used as stored): ${hashable.filter((l) => !preFix(l)).length}`,
)
console.log(`  not on a bank account, left alone: ${unhashable.length}`)
console.log(`  would change: ${changed.length}`)
const lineById = new Map(hashable.map((line) => [line.id, line]))
if (changed.length > 0 && changed.length <= 20) {
  console.log("Lines that would change:")
  for (const update of changed) {
    const line = lineById.get(update.id)!
    console.log(
      `  line ${line.id}: account ${line.accountNumber}, stored ${toIsoDate(line.statementDate ?? line.date)}, ${line.amount}, created ${line.createdAt.toISOString().slice(0, 16)}Z`,
    )
  }
}
console.log(`Lines sharing an account, date and amount with an earlier line: ${repeated}`)
console.log(`New hashes that collide: ${collisions}`)

// The hours with imports either side of the cutoff, to check it sits in a gap.
const perHour = new Map<string, number>()
for (const line of hashable) {
  const hour = line.createdAt.toISOString().slice(0, 13)
  perHour.set(hour, (perHour.get(hour) ?? 0) + 1)
}
const cutoffHour = fixedAt.toISOString().slice(0, 13)
const hours = [...perHour.keys()].sort()
const before = hours.filter((hour) => hour <= cutoffHour).slice(-2)
const after = hours.filter((hour) => hour > cutoffHour).slice(0, 2)
console.log("Imports around the cutoff (UTC hour: lines):")
for (const hour of [...before, "-- fix deployed here --", ...after]) {
  console.log(`  ${hour}${perHour.has(hour) ? `: ${perHour.get(hour)}` : ""}`)
}

if (collisions > 0) {
  console.error("Collisions found - nothing written.")
  process.exit(1)
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
  "../../data",
  `import-hash-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
)
await mkdir(path.dirname(backupPath), { recursive: true })
await writeFile(
  backupPath,
  JSON.stringify(
    updates.map(({ id, oldHash }) => ({ id, oldHash })),
    null,
    2,
  ),
)
console.log(`Old hashes saved to ${backupPath}`)

await db.transaction(async (tx) => {
  for (const update of changed) {
    await tx
      .update(journalLine)
      .set(withUpdate(importer.id, { hash: update.newHash }))
      .where(eq(journalLine.id, update.id))
  }
})
console.log(`Updated ${changed.length} lines.`)
process.exit(0)
