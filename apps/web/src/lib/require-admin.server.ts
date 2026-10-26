import { getRequest } from "@tanstack/react-start/server"
import { getVerifiedSession } from "./auth-session.server.ts"

// The route guard on /books/admin only controls navigation; server
// functions are plain HTTP endpoints anyone logged in can call directly.
// Call this first in every admin-only handler. Server-only: import it
// from handlers, never at the top level of browser-reachable code.
export async function requireAdmin() {
  const session = await getVerifiedSession(getRequest().headers)
  if (session?.user.role !== "admin") {
    throw new Error("Forbidden: administrators only.")
  }
  return session.user
}
