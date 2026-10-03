import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { Button } from '#/components/ui/button.tsx';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { UsersTable } from './-components/users-table.tsx';
import { getUsers } from './-components/users-fn.ts';

export const Route = createFileRoute('/books/admin/users/')({
  loader: async () => ({ users: await getUsers() }),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  useSetBreadcrumbs([{ title: 'Users' }]);
  const { users } = Route.useLoaderData();

  return (
    <>
      <div className="flex items-center justify-between">
        <h2>Users</h2>
        <Button asChild>
          <Link to="/books/admin/users/new">
            <PlusIcon />
            New user
          </Link>
        </Button>
      </div>
      <div className="mt-4">
        <UsersTable
          data={users}
          onEdit={(user) => navigate({ to: '/books/admin/users/$id', params: { id: user.id } })}
        />
      </div>
    </>
  );
}
