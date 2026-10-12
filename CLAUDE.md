# venture-accounts

A pnpm workspace managing Venture Church's bank accounts for financial reporting. Must comply with South African bookkeeping/accounting practices (GAAP/IFRS for SMEs, SARS NPO/PBO rules) — flag anything that doesn't.

## Domain language

Naming conventions and terminology live in [Ledger Ubiquitous Language.md](./docs/Ledger%20Ubiquitous%20Language.md) — check it before introducing new domain terms, and update it when one is resolved.

## Environment

All packages read from the root `.env`; a package-local `.env.local` (gitignored) overrides it. Both are loaded by absolute path, not the default cwd-relative lookup, so scripts work regardless of which package's directory they're run from.

## Route folder layout

Each route folder under `apps/web/src/routes/` separates server and client code. Folders starting with `-` are ignored by the router (a plain `lib` folder would become a route).

- `-server/*.server.ts` — server functions (`createServerFn` handlers). Client code imports these. Keep ALL database code inside the handlers.
- `-server/internal/*.server.ts` — server-only helpers used from the handlers. Never import these from client code; the build fails if you do.
- `-lib/` — client-side files: components, tables, dialogs, TanStack Query options.

Why it works: `vite.config.ts` exempts only `routes/**/-server/*.server.ts` from import protection (`**/*.server.*` is otherwise denied in the browser build). The compiler replaces the handlers with RPC stubs there. `src/lib/*.server.ts` (auth, settings helpers) stays fully server-only.
