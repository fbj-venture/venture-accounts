import { auth } from "./auth.ts"
import { isSessionVerified } from "./second-factor.server.ts"

// The session behind these request headers, split by whether the user has
// finished signing in. "pending" has only passed the password (or Google)
// step - it still owes a passkey - so nothing but the sign-in screens may
// treat it as a signed-in user. Every server-side check goes through here.
export async function getSessionState(headers: Headers) {
  const current = await auth.api.getSession({ headers })
  if (!current) {
    return { state: "none" as const }
  }
  const cached =
    (current.session as { secondFactorVerified?: boolean }).secondFactorVerified === true
  if (await isSessionVerified(current.session.id, cached)) {
    return { state: "verified" as const, ...current }
  }
  return { state: "pending" as const, ...current }
}

/** The fully signed-in session, or null (no session, or passkey still owed). */
export async function getVerifiedSession(headers: Headers) {
  const result = await getSessionState(headers)
  return result.state === "verified" ? result : null
}
