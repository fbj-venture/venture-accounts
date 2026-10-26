import { Button } from "#/components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { authClient } from "#/lib/auth-client.ts"
import { clearSessionCache } from "#/routes/books/-lib/session-query.ts"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { RecoveryCodesStep } from "./-lib/recovery-codes-step.tsx"
import { getSecondFactorState } from "./-server/second-factor.server.ts"

// The last step of signing in. Whoever got past the password (or Google) is
// either setting up their passkey for the first time - create it, then save
// recovery codes - or proving they hold it. Nothing under /books opens until
// this is done (see lib/second-factor.server.ts).
export const Route = createFileRoute("/second-factor/")({
  loader: async () => {
    const state = await getSecondFactorState()
    if (state.state === "none") {
      throw redirect({ to: "/" })
    }
    if (state.state === "verified") {
      throw redirect({ to: "/books" })
    }
    return state
  },
  component: SecondFactor,
})

function SecondFactor() {
  const state = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [useCode, setUseCode] = useState(false)
  const [code, setCode] = useState("")

  // Runs one step; the action returns a problem to show, or null if it worked.
  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const problem = await action()
    if (problem) {
      setError(problem)
    }
    setBusy(false)
  }

  async function finished() {
    clearSessionCache(queryClient)
    await navigate({ to: "/books" })
  }

  async function getCodes() {
    const { data, error: codesError } = await authClient.$fetch<{ codes: string[] }>(
      "/second-factor/recovery-codes",
      { method: "POST", body: {} },
    )
    if (codesError || !data) {
      return codesError?.message ?? "The recovery codes couldn't be created."
    }
    setCodes(data.codes)
    return null
  }

  const createPasskey = () =>
    run(async () => {
      const { error: addError } = await authClient.passkey.addPasskey({ name: "Venture Accounts" })
      if (addError) {
        return addError.message ?? "The passkey couldn't be created."
      }
      return getCodes()
    })

  const confirmEnrolment = () =>
    run(async () => {
      const { error: doneError } = await authClient.$fetch("/second-factor/complete-enrolment", {
        method: "POST",
        body: {},
      })
      if (doneError) {
        return doneError.message ?? "Couldn't finish setting up."
      }
      await finished()
      return null
    })

  const verifyPasskey = () =>
    run(async () => {
      const { error: signInError } = await authClient.signIn.passkey()
      if (signInError) {
        return signInError.message ?? "The passkey wasn't accepted."
      }
      await finished()
      return null
    })

  const submitCode = () =>
    run(async () => {
      const { error: codeError } = await authClient.$fetch("/second-factor/use-recovery-code", {
        method: "POST",
        body: { code },
      })
      if (codeError) {
        return codeError.message ?? "That code wasn't accepted."
      }
      await finished()
      return null
    })

  async function cancel() {
    await authClient.signOut()
    clearSessionCache(queryClient)
    await navigate({ to: "/" })
  }

  // Not enrolled yet (or enrolment was abandoned part way): passkey first,
  // then the codes.
  const enrolling = !state.enrolled

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5" />{" "}
            {enrolling ? "Set up your passkey" : "Confirm it's you"}
          </CardTitle>
          <CardDescription>
            {enrolling
              ? "Signing in now needs a passkey as well as your password. It uses your device's fingerprint, face or PIN."
              : `Welcome back, ${state.name}. Use your passkey to finish signing in.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {enrolling && codes ? (
            <RecoveryCodesStep
              codes={codes}
              email={state.email}
              busy={busy}
              onContinue={confirmEnrolment}
            />
          ) : enrolling ? (
            <>
              <p className="text-sm">
                Create the passkey on this device. Next you'll get recovery codes, in case you lose
                it.
              </p>
              <Button onClick={createPasskey} disabled={busy}>
                {busy ? "Waiting for your device..." : "Create passkey"}
              </Button>
            </>
          ) : useCode ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void submitCode()
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="recovery-code">Recovery code</FieldLabel>
                  <Input
                    id="recovery-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="off"
                    placeholder="XXXXX-XXXXX"
                    required
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={busy || code.trim() === ""}>
                {busy ? "Checking..." : "Use recovery code"}
              </Button>
              <Button type="button" variant="link" onClick={() => setUseCode(false)}>
                Use my passkey instead
              </Button>
            </form>
          ) : (
            <>
              <Button onClick={verifyPasskey} disabled={busy}>
                {busy ? "Waiting for your device..." : "Use passkey"}
              </Button>
              <Button type="button" variant="link" onClick={() => setUseCode(true)}>
                I can't use my passkey
              </Button>
            </>
          )}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
            Cancel and sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
