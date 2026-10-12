import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
// Type-only: loads @tanstack/start-client-core's declare-module augmentation
// (adds the `server` route option) into the program. Nothing in src/
// otherwise imports @tanstack/react-start's main entry, so without this,
// createFileRoute(...)({ server: {...} }) doesn't type-check.
import type {} from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // One per request on the server (never a module singleton, or users would
  // share a cache); the browser keeps its own for the life of the page.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  })

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: { queryClient },
  })

  // Provides QueryClientProvider and carries the server-fetched cache over to
  // the browser.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
