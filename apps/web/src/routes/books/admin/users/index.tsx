import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/books/admin/users/')({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Users' }]);

  return <div>Hello "/books/admin/users/"!</div>
}
