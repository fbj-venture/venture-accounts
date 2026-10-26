# Key Rotation Checklist

Reusable runbook for rotating every secret venture-accounts depends on. Source of truth for what exists is [.env.schema](../.env.schema); if you add a service or secret there, add it here too.

**Last full rotation:** _not yet done_ (first run prompted by hosting provider recommendation, Oct 2026)

## Ground rules

- **New first, old last.** Create the new credential, deploy it, verify the app works, _then_ revoke the old one. Never revoke first.
- **Never paste secrets into chat, commits, tickets or screenshots.** Use a password manager as the staging area.
- **Do production last, and off-peak.** Rotate in a quiet window; the app briefly restarts and sessions may drop.
- Railway variables are the live source. Local `.env` and `packages/db/.env` are copies and need updating too, otherwise local scripts and migrations will fail with auth errors.
- Record each rotation in the log at the bottom.

## Before you start

- [ ] Password manager open, with a scratch note for the new values
- [ ] Access to: Railway, Neon, Resend, Google Cloud Console (and the GitHub repo if CI uses any of these)
- [ ] Know the app's own admin login so you can verify after deploying
- [ ] Check git history for leaked secrets if the rotation was prompted by an incident: `git log -p -S"re_" -- .` and look for committed `.env` files
- [ ] Decide the window and tell anyone who uses the app (brief logouts are expected)

## 1. Neon PostgreSQL — `DATABASE_URL_UNPOOLED`

Highest impact: a leaked connection string exposes all financial data.

- [ ] Neon console → project → **Roles** → reset the password of the app role (or create a new role and grant it the same privileges, which allows a no-downtime swap)
- [ ] Copy the new **unpooled** connection string (the app uses the `pg.Pool` driver, not the pooled one)
- [ ] Update `DATABASE_URL_UNPOOLED` in Railway
- [ ] Update `DATABASE_URL_UNPOOLED` in local `.env` and `packages/db/.env`
- [ ] Check no other `NEON_BRANCH` (dev, preview) uses the old password; rotate those branch roles too
- [ ] If a new role was created instead: revoke/drop the old role once the app is verified
- [ ] Neon API key (if one is stored anywhere, e.g. CI or the `.neon` setup): regenerate it under Account → API keys and revoke the old one

## 2. Better Auth — `BETTER_AUTH_SECRET`

- [ ] Generate a new value: `openssl rand -base64 32` (or `pnpm dlx @better-auth/cli secret`)
- [ ] Update in Railway, then local `.env`
- [ ] **Expect:** all users are signed out and in-flight sessions, password-reset links and invitation tokens signed with the old secret stop working. Re-send any pending invitations afterwards.
- [ ] Confirm `BETTER_AUTH_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` are still correct (not secrets, but easy to break while editing variables)
- [ ] After deploy, log in and confirm a session persists across a page reload

## 3. Resend — `RESEND_API_KEY`

- [ ] Resend dashboard → **API Keys** → create a new key (sending access, scoped to the verified domain if possible); the key starts with `re_`
- [ ] Update in Railway, then local `.env`
- [ ] Deploy, then trigger a real email (password reset or invitation) and confirm it arrives
- [ ] Delete the old key in Resend
- [ ] `EMAIL_FROM` needs no change unless the sending domain changed

## 4. Railway Bucket (S3) — `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`

`S3_ENDPOINT`, `S3_BUCKET` and `S3_REGION` are not secrets.

- [ ] Rotate the bucket credentials in Railway (bucket service → Credentials / regenerate). If the app variables are Railway references (`${{Bucket.ACCESS_KEY_ID}}`), they update automatically; otherwise paste the new values
- [ ] Update local `.env` if you use the real bucket locally (the docker-compose environment uses throwaway local credentials and needs nothing)
- [ ] Deploy, then import a PDF statement and download it again to prove both upload and presigned download work
- [ ] Confirm the old credentials no longer work

## 5. Google sign-in — `GOOGLE_CLIENT_SECRET`

Optional: skip if Google sign-in isn't enabled. `GOOGLE_CLIENT_ID` is not a secret.

- [ ] Google Cloud Console → **APIs & Services** → **Credentials** → the OAuth 2.0 client → **Add secret** (the client can hold two secrets at once, so this is a no-downtime swap)
- [ ] Update `GOOGLE_CLIENT_SECRET` in Railway, then local `.env`
- [ ] Deploy, then sign in with Google and confirm it works
- [ ] Disable, then delete, the old secret in Google Cloud Console

## 6. Railway itself

- [ ] Rotate any **Railway API / project tokens** used by CI or scripts (Account → Tokens), update wherever stored, delete the old ones
- [ ] Review team members and remove anyone who shouldn't have access
- [ ] Review the Variables tab for secrets you don't recognise or no longer use, and delete them
- [ ] Redeploy the service so every variable change is picked up

## 7. Application accounts

- [ ] `ADMIN_PASSWORD`: only used on first run when there are no users. If it was ever set in production, make sure it is removed from Railway and change the real admin's password in the app
- [ ] Change the passwords of any app users who share the previous admin credentials, or who were exposed by the incident
- [ ] `PDF_PASSWORD`: this is the bank's statement password, not ours. Rotate only if the bank lets you change it, and keep it in sync with the PDF downloads

## 8. Source control and CI

- [ ] GitHub: rotate personal access tokens and deploy keys that touch this repo; review Actions secrets and Dependabot/Codespaces secrets
- [ ] Confirm `.env`, `.env.local` and `packages/db/.env` are gitignored and were never committed
- [ ] If a secret was ever committed, rotating it is mandatory (history rewrite alone is not enough)

## 9. Verify everything

- [ ] App loads and you can log in
- [ ] Google sign-in works (if enabled)
- [ ] Data loads from the database (open an account and its transactions)
- [ ] Email sends (password reset or invitation)
- [ ] PDF import works and the stored file downloads
- [ ] Railway deploy logs show no auth, S3 or Resend errors
- [ ] Local dev: `pnpm dev` and `pnpm --filter @app/db db:migrate` work with the updated `.env` files

## 10. Clean up

- [ ] All **old** credentials revoked or deleted (Neon role/password, Resend key, bucket keys, Google client secret, tokens)
- [ ] Scratch note in the password manager tidied; only current values kept
- [ ] Rotation log below updated
- [ ] "Last full rotation" date at the top updated

## Not rotated by this checklist

The local docker-compose values (`venture`/`venture`, `local-dev-secret-not-for-production`, `venture-local-secret`) are throwaway, published to localhost only, and not real credentials. Never reuse them in production.

## If something breaks

| Symptom                                                     | Likely cause                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Everyone logged out / invitation links dead                 | Expected after `BETTER_AUTH_SECRET` change                                                  |
| `password authentication failed`                            | New Neon password not in Railway or local `.env`, or pooled string used instead of unpooled |
| Emails silently not sent                                    | `RESEND_API_KEY` wrong or has restricted scope, or the domain isn't verified                |
| Upload or download fails with `SignatureDoesNotMatch` / 403 | Stale S3 key or secret in Railway                                                           |
| Local migrations fail but production is fine                | `packages/db/.env` not updated                                                              |
| Google sign-in fails with `invalid_client`                  | New `GOOGLE_CLIENT_SECRET` not in Railway, or the old secret was deleted before the swap    |

Roll back by restoring the previous value only if the old credential hasn't been revoked yet, which is why revocation comes last.

## Rotation log

| Date | Who | Services rotated | Reason                          | Notes |
| ---- | --- | ---------------- | ------------------------------- | ----- |
|      |     |                  | Hosting provider recommendation |       |
