import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/books/admin/users/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/books/admin/users/"!</div>
}
