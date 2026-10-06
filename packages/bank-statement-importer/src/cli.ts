// CLI entry for `pnpm read-pdf -- <path-to-pdf> [user-email]`. Kept separate from
// index.ts (the library entry every consumer, including the deployed web
// server, imports) so this argv-reading, process.exit-calling code can never
// run as a side effect of importing the library - it did, once index.ts got
// bundled into the server: process.argv[1] there is the server's own entry
// file, which happened to make the old same-file "am I being run directly"
// check true, printing the usage message and killing the server on every
// request.
import { db, user } from "@app/db/direct";
import { eq } from "drizzle-orm";
import { readPdfFileFromFile } from "./index.js";

// Imported entries are attributed to this user (createdBy/updatedBy) unless
// another email is given.
const DEFAULT_USER_EMAIL = "francis@venturechurch.co.za";

const [filePath, email = DEFAULT_USER_EMAIL] = process.argv.slice(2).filter((arg) => arg !== "--");
if (!filePath) {
   console.error("Usage: pnpm read-pdf -- <path-to-pdf> [user-email]");
   process.exit(1);
}

const [importer] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
if (!importer) {
   console.error(`No user with email ${email}.`);
   process.exit(1);
}

await readPdfFileFromFile(filePath, importer.id);
