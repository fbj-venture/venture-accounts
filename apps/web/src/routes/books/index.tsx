import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/books/')({
  component: RouteComponent,
})

function RouteComponent() {
  useSetBreadcrumbs([{ title: 'Dashboard' }]);

  return <>
    <h2>Accounts Dashboard</h2>

  </>;
}
