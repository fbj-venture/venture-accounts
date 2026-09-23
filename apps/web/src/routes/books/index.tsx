import { createFileRoute } from '@tanstack/react-router';
import { useSetBreadcrumbs } from '#/routes/books/-breadcrumbs.ts';

export const Route = createFileRoute('/books/')({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard' }]);

  return <>
    <h2>Accounts Dashboard</h2>

  </>;
}
