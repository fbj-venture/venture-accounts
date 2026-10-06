import { getRequest } from "@tanstack/react-start/server";
import { auth } from "./auth.ts";

// The signed-in user, for stamping the audit columns (createdBy/updatedBy -
// see withCreate/withUpdate in @app/db). Call it first in any handler that
// writes to bank_recon, journal or journal_line. Server-only: import it from
// handlers, never at the top level of browser-reachable code.
export async function requireUser() {
  const session = await auth.api.getSession({ headers: getRequest().headers });
  if (!session) {
    throw new Error("Unauthorized: sign in first.");
  }
  return session.user;
}
