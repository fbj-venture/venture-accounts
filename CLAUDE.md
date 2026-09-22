# venture-accounts

A pnpm workspace managing Venture Church's bank accounts for financial reporting. Must comply with South African bookkeeping/accounting practices (GAAP/IFRS for SMEs, SARS NPO/PBO rules) — flag anything that doesn't.

## Domain language

Naming conventions and terminology live in [Ledger Ubiquitous Language.md](./docs/Ledger%20Ubiquitous%20Language.md) — check it before introducing new domain terms, and update it when one is resolved.

## Environment

All packages read from the root `.env`; a package-local `.env.local` (gitignored) overrides it. Both are loaded by absolute path, not the default cwd-relative lookup, so scripts work regardless of which package's directory they're run from.
