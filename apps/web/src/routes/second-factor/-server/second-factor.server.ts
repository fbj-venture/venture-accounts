import { getSessionState } from "#/lib/auth-session.server.ts"
import { countPasskeys, isEnrolled, unusedRecoveryCodes } from "#/lib/second-factor.server.ts"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

// Where the user is in finishing signing in. Keep ALL database code inside
// handlers - see transactions-fn.ts for why.
export const getSecondFactorState = createServerFn({ method: "GET" }).handler(async () => {
  const result = await getSessionState(getRequest().headers)
  if (result.state === "none") {
    return { state: "none" as const }
  }
  if (result.state === "verified") {
    return { state: "verified" as const }
  }
  const userId = result.user.id
  return {
    state: "pending" as const,
    name: result.user.name,
    email: result.user.email,
    enrolled: await isEnrolled(userId),
    hasPasskey: (await countPasskeys(userId)) > 0,
    codesLeft: await unusedRecoveryCodes(userId),
  }
})
