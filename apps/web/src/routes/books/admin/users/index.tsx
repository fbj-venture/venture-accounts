import { createFileRoute } from '@tanstack/react-router';
import { useSetBreadcrumbs } from '#/routes/books/-breadcrumbs.ts';

export const Route = createFileRoute('/books/admin/users/')({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Users' }]);

  return <div>Hello "/books/admin/users/"!</div>
}
