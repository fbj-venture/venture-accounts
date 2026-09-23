import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/books/transactions/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/books/transactions/"!</div>
}
