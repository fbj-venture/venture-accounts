import { eq } from "drizzle-orm"
import { db, user } from "../src/index.js"

const SCRIPT_USER_EMAIL = "francis@venturechurch.co.za"

// Scripts have no signed-in user, so rows they create are attributed to this
// person for the audit columns (createdBy / updatedBy).
export async function getScriptUserId(): Promise<string> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, SCRIPT_USER_EMAIL))
  if (!row) {
    throw new Error(`Script user ${SCRIPT_USER_EMAIL} does not exist in auth.user`)
  }
  return row.id
}

// Shared runner for one-off data scripts (e.g. seeding default rows). Each
// script calls runScript(...) with its own async function; the harness
// takes care of consistent logging and a non-zero exit code on failure, so
// a script can just focus on what it inserts.
export async function runScript(name: string, script: () => Promise<void>): Promise<void> {
  console.log(`Running ${name}...`)

  try {
    await script()
    console.log(`Done: ${name}`)
  } catch (error) {
    console.error(`Failed: ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}
