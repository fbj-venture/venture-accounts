---
name: rotate-secrets
description: Walk the user through rotating every external service secret (Neon, Better Auth, Resend, Railway bucket, tokens) one step at a time, following docs/Key Rotation Checklist.md. Use when the user types /rotate-secrets or asks to rotate keys or secrets.
disable-model-invocation: true
---

# Rotate secrets

Guide the user through a secret rotation interactively. The runbook is [docs/Key Rotation Checklist.md](../../../docs/Key%20Rotation%20Checklist.md), which is the single source of truth. Read it at the start of every run, since it may have changed. Do not work from memory of an earlier version.

## Rules

- **Never ask for, accept, print or store secret values.** The user pastes new values into Railway, their password manager and local `.env` files themselves. If they paste one anyway, tell them to rotate it again and do not repeat it.
- **Order is new, deploy, verify, then revoke old.** Never suggest revoking an old credential before the new one is verified.
- **One service at a time.** Present a single section, wait for the user to confirm it is done, then move on. Do not dump the whole checklist.
- **Do not touch production for them.** You can read files and run local verification commands. The dashboard steps (Neon, Railway, Resend, GitHub) are the user's to perform, so tell them exactly where to click.
- Edit `.env` or `packages/db/.env` only if the user asks, and never display their contents.

## Flow

1. Read the checklist. Compare its services against `.env.schema`. If `.env.schema` has a secret (`@sensitive`) the checklist doesn't cover, flag it and offer to add it to the checklist before starting.
2. Ask one question: is this a routine rotation or prompted by an incident (a suspected leak)? For an incident, run the "Before you start" git-history check and rotate in the order Neon, Better Auth, Resend, S3, then tokens. For a routine rotation, ask which services to include (default: all).
3. Walk through the selected sections in checklist order. For each one:
   - Summarise what to do in a few lines, noting the impact (for example, Better Auth logs everyone out).
   - Tell the user to say "done", "skip", or describe a problem.
   - On a problem, use the checklist's "If something breaks" table to help diagnose.
4. After all sections, run the checklist's verify section. Run the parts you can locally (for example `pnpm --filter @app/db db:migrate` or a type check) and ask the user to confirm the in-app checks (login, email, PDF import and download).
5. Only after verification, walk through the clean-up section so the old credentials are revoked.
6. Update the checklist file: set "Last full rotation" to today's date if every service was rotated, and append a row to the rotation log (date, services rotated, reason, notes). Do not record any secret values. Ask before writing.
7. Suggest improvements to the checklist if the run exposed gaps, such as a new service or a step that was unclear, and apply them to the checklist file if the user agrees.

## Style

Keep each message short and actionable. Use the checklist's own wording for the steps so the two stay consistent.
