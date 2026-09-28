import { createFileRoute } from '@tanstack/react-router';
import { useSetBreadcrumbs } from '../../-components/breadcrumbs';

export const Route = createFileRoute('/books/banking/recon/$id')({
   component: RouteComponent,
});

function RouteComponent() {
   useSetBreadcrumbs([
      { title: "Dashboard", url: "/books" }
   ]);

   return <div>Hello "/books/banking/recon/$id"!</div>;
}
