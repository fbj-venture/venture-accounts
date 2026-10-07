import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import { authClient } from '#/lib/auth-client.ts';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

// Public. Asks for the account's email and has better-auth email a reset
// link, which lands on /set-password. The answer is the same whether or not
// the address has an account, so the form can't be used to find out who does.
// The endpoint is rate limited per IP, and each address per hour, on the
// server - see lib/auth.ts.
export const Route = createFileRoute('/forgot-password')({
  component: RouteComponent,
});

function RouteComponent() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: '/set-password',
    });
    if (requestError?.status === 429) {
      setError('Too many requests. Please wait a few minutes and try again.');
    } else if (requestError) {
      setError(requestError.message ?? "Couldn't send the email.");
    } else {
      setSent(true);
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sent ? (
            <p className="text-sm">
              If that email address has an account, a link to reset the password is on its way. It
              works for one hour.
            </p>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a link to choose a new password.
              </p>
              <Field>
                <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy || email.trim() === ''}>
                {busy ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}
          <Link to="/" className="text-sm underline-offset-2 hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
