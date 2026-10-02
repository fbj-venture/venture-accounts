import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';
import { UsersTable } from './-components/users-table.tsx';
import { getUsers } from './-components/users-fn.ts';

export const Route = createFileRoute('/books/admin/users/')({
  loader: async () => ({ users: await getUsers() }),
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Users' }]);
  const { users } = Route.useLoaderData();

  return (
    <>
      <h2>Users</h2>
      <div className="mt-4">
        {/* Editing isn't built yet - the button is wired but does nothing. */}
        <UsersTable data={users} onEdit={() => {}} />
      </div>
    </>
  );
}
