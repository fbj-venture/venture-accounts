import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import { authClient } from '#/lib/auth-client.ts';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

// Where the link in an invitation email lands (see sendInvitationEmail in
// lib/invitation.server.ts): the new user chooses their password. Public -
// the token in the link is what authorises it.
export const Route = createFileRoute('/set-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' && search.token ? search.token : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password !== '' && password.length < 8;
  const mismatch = confirmPassword !== '' && password !== confirmPassword;
  const canSubmit = !busy && password.length >= 8 && password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !token) {
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (resetError) {
      setError(
        resetError.code === 'INVALID_TOKEN'
          ? 'This link has expired or has already been used. Ask an administrator to send you a new invitation.'
          : (resetError.message ?? "Couldn't set your password."),
      );
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose your password</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="grid gap-4 text-sm">
              <p>Your password is set. You can now sign in.</p>
              <Button asChild>
                <Link to="/">Sign in</Link>
              </Button>
            </div>
          ) : !token ? (
            <p className="text-sm text-destructive" role="alert">
              This link isn't valid. Use the link in your invitation email.
            </p>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="set-password">Password</FieldLabel>
                  <Input
                    id="set-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    aria-invalid={tooShort}
                    required
                  />
                  <FieldDescription className={tooShort ? 'text-destructive' : undefined}>
                    At least 8 characters.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="set-confirm-password">Confirm password</FieldLabel>
                  <Input
                    id="set-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    aria-invalid={mismatch}
                    required
                  />
                  {mismatch ? (
                    <FieldDescription className="text-destructive">
                      The passwords don't match.
                    </FieldDescription>
                  ) : null}
                </Field>
              </FieldGroup>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={!canSubmit}>
                {busy ? 'Saving...' : 'Set password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
