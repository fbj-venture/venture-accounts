import { LoginForm } from '#/components/login-form';
import { authClient } from '#/lib/auth-client.ts';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleLogin(values: { email: string; password: string }) {
    setPending(true);
    setError(null);

    // Goes through /api/auth/sign-in/email (auth.handler), not auth.api directly,
    // so better-auth's rate limiter and origin check actually apply.
    const { error: signInError } = await authClient.signIn.email(values);

    if (!signInError) {
      await navigate({ to: '/books' });
    } else {
      setError(signInError.message ?? 'Unable to sign in.');
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm onLogin={handleLogin} error={error} pending={pending} />
      </div>
    </div>
  );
}
