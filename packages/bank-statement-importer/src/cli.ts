// CLI entry for `pnpm read-pdf -- <path-to-pdf>`. Kept separate from
// index.ts (the library entry every consumer, including the deployed web
// server, imports) so this argv-reading, process.exit-calling code can never
// run as a side effect of importing the library - it did, once index.ts got
// bundled into the server: process.argv[1] there is the server's own entry
// file, which happened to make the old same-file "am I being run directly"
// check true, printing the usage message and killing the server on every
// request.
import { readPdfFileFromFile } from "./index.js";

const filePath = process.argv.slice(2).find((arg) => arg !== "--");
if (!filePath) {
   console.error("Usage: pnpm read-pdf -- <path-to-pdf>");
   process.exit(1);
}

await readPdfFileFromFile(filePath);
