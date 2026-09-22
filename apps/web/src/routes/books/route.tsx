import { Button } from '#/components/ui/button.tsx';
import { authClient } from '#/lib/auth-client.ts';
import { auth } from '#/lib/auth.ts';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { Wallet2Icon } from 'lucide-react';

const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  return await auth.api.getSession({ headers: getRequest().headers });
});

export const Route = createFileRoute('/books')({
  beforeLoad: async () => {
    const authSession = await getAuthSession();
    if (!authSession) {
      throw redirect({ to: '/' });
    }
    return { user: authSession.user };
  },
  component: BooksLayout,
});

function BooksLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const signout = async () => {
    await authClient.signOut();
    await navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b bg-muted-foreground px-6 py-3">
        <h1 className='flex gap-2 items-center text-2xl'>
          <Wallet2Icon className="size-7 text-primary" />
          <p>
            <span className="font-semibold">Venture</span>
            &nbsp;
            <span className="font-semibold text-primary">Accounts</span>
          </p>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-accent" >{user.name}</span>
          <Button
            variant="link"
            size="sm"
            onClick={signout}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
