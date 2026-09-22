import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { APIError } from 'better-auth/api';
import { LoginForm } from '#/components/login-form';
import { auth } from '#/lib/auth.ts';

const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    try {
      await auth.api.signInEmail({
        body: { email: data.email, password: data.password },
      });
      return { success: true as const };
    } catch (error) {
      if (error instanceof APIError) {
        return { success: false as const, error: error.message };
      }
      throw error;
    }
  });

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleLogin(values: { email: string; password: string }) {
    setPending(true);
    setError(null);

    const result = await loginFn({ data: values });

    if (result.success) {
      await navigate({ to: '/books' });
    } else {
      setError(result.error);
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
