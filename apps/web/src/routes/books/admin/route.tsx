import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

// Everything under /books/admin is for administrators only. The user comes
// from the parent /books route's session lookup. The data itself is also
// protected server-side - see requireAdmin().
export const Route = createFileRoute('/books/admin')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') {
      throw redirect({ to: '/books' });
    }
  },
  component: Outlet,
});
