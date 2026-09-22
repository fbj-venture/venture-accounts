import { createRouter as createTanStackRouter } from '@tanstack/react-router'
// Type-only: loads @tanstack/start-client-core's declare-module augmentation
// (adds the `server` route option) into the program. Nothing in src/
// otherwise imports @tanstack/react-start's main entry, so without this,
// createFileRoute(...)({ server: {...} }) doesn't type-check.
import type {} from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
