import { LoginForm } from "#/components/login-form"
import { authClient } from "#/lib/auth-client.ts"
import { clearSessionCache } from "#/routes/books/-lib/session-query.ts"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { getGoogleSignInAvailable } from "./-server/sign-in-options.server.ts"

// Where Better Auth sends the browser back to when a Google sign-in fails.
const GOOGLE_ERRORS: Record<string, string> = {
  signup_disabled:
    "No account is linked to that Google account. Sign in with your password, then link Google from My Account.",
  access_denied: "Google sign-in was cancelled.",
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  loader: async () => ({ googleAvailable: await getGoogleSignInAvailable() }),
  component: Home,
})

function Home() {
  const { appCompany } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { googleAvailable } = Route.useLoaderData()
  const { error: searchError } = Route.useSearch()
  const [error, setError] = useState<string | null>(
    searchError ? (GOOGLE_ERRORS[searchError] ?? "Google sign-in failed.") : null,
  )
  const [pending, setPending] = useState(false)

  async function handleLogin(values: { email: string; password: string }) {
    setPending(true)
    setError(null)

    // Goes through /api/auth/sign-in/email (auth.handler), not auth.api directly,
    // so better-auth's rate limiter and origin check actually apply.
    const { error: signInError } = await authClient.signIn.email(values)

    if (!signInError) {
      clearSessionCache(queryClient)
      await navigate({ to: "/books" })
    } else {
      setError(signInError.message ?? "Unable to sign in.")
      setPending(false)
    }
  }

  async function handleGoogleLogin() {
    setPending(true)
    setError(null)
    // Redirects to Google and back, so on success this page is left.
    const { error: signInError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/books",
      errorCallbackURL: "/",
    })
    if (signInError) {
      setError(signInError.message ?? "Unable to sign in with Google.")
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm
          appCompany={appCompany}
          onLogin={handleLogin}
          onGoogleLogin={googleAvailable ? handleGoogleLogin : undefined}
          error={error}
          pending={pending}
        />
      </div>
    </div>
  )
}
