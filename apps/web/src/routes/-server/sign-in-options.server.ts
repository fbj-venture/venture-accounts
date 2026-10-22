import { createServerFn } from "@tanstack/react-start"
import { ENV } from "varlock/env"

// Whether the login page offers "Login with Google". Public (no sign-in
// needed): it is read before anyone has signed in.
export const getGoogleSignInAvailable = createServerFn({ method: "GET" }).handler(() =>
  Boolean(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET),
)
