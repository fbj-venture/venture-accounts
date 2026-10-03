# Resend

How to get from nothing to sending a test email from this project (TypeScript, TanStack Start, pnpm workspace). It assumes you have never used Resend and have not set anything up yet.

Resend is a hosted service for sending email from code. You give it an API key, it sends the message and shows you what happened to it in a dashboard. The only part that takes real effort is proving to the world that you are allowed to send mail from your own domain (step 6) - the rest is a few lines of code.

**What you need before starting**
- An email address you can receive mail at (this becomes the Resend account owner).
- To send from your own address (e.g. `accounts@yourchurch.org.za`): access to the DNS settings of that domain. Whoever registered the domain or hosts its website can give you this. You can do the first test without it.

---

## 1. Create a Resend account

1. Go to <https://resend.com> and choose **Sign up**.
2. Register with the email address that should own the account, and confirm it from the email Resend sends.
3. You land on the dashboard. Everything below happens in its left-hand menu: **Emails**, **Domains**, **API Keys**.

The account's free plan is enough for a church's accounting app (a handful of emails). Limits and prices change, so check <https://resend.com/pricing> rather than trusting a number written here.

## 2. Create an API key

The API key is the password your code uses to send mail. Treat it like a database password.

1. Dashboard -> **API Keys** -> **Create API Key**.
2. Name: something that says where it is used, e.g. `venture-accounts-dev`. Make a separate key per environment (dev, production) so one can be revoked on its own.
3. Permission: **Sending access** (not Full access). Sending access can only send mail, so a leaked key can't read your emails or change your domain.
4. Domain: leave it as *All domains* for now. Once your domain is verified you can create a key restricted to just that domain.
5. **Add**, then **copy the key now** - it starts with `re_` and Resend only shows it once. If you lose it, delete it and make another.

## 3. Put the key in the project's environment

This project reads every environment variable through `@app/env` (see `packages/env/src/index.ts`), which validates them at startup. Don't read `process.env` directly.

**a) Add the variables to `.env`** (the repo root `.env`, which is gitignored):

```ini
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# For the first test (step 5) this must be exactly this value:
EMAIL_FROM=Venture Accounts <onboarding@resend.dev>
```

**b) List them in `env.example`** (no real values - this file is committed):

```ini
RESEND_API_KEY=
EMAIL_FROM=
```

**c) Declare them in the schema**, in `packages/env/src/index.ts`, inside `server: { ... }`:

```ts
RESEND_API_KEY: z.string().startsWith("re_"),
EMAIL_FROM: z.string().min(1),
```

Two consequences of that being required:
- The app won't start without them. Add both variables to the hosting platform's environment (Railway) **before** you deploy this change.
- They are `server` variables, so they can never reach the browser - as long as you only use them in server code (step 5).

## 4. Install the Resend package

From the repo root (pnpm, scoped to the web app):

```bash
pnpm --filter web add resend
```

## 5. Send a test email

Resend lets every account send *without* any DNS setup using its shared test address, `onboarding@resend.dev`, with one restriction: **it can only deliver to the email address you signed up with**. That is enough to prove the code works.

### 5a. A small mailer module

Create `apps/web/src/lib/email.server.ts`:

```ts
import { env } from "@app/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(options: { to: string | string[]; subject: string; html: string }) {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    ...options,
  });

  // The SDK reports failures in `error` instead of throwing - always check it.
  if (error) {
    throw new Error(`Couldn't send email: ${error.message}`);
  }
  return data; // { id: "..." } - the id you can look up in the dashboard
}
```

Why the `.server.ts` suffix matters: in TanStack Start, code that is reachable from a route is bundled for the browser too, and a server-only import at the top level of such a file can leak into the client bundle and break the whole app (this project has been bitten by exactly that with the database - see the note at the top of `transactions-fn.ts`). Keep this module imported **only from inside server function handlers or scripts**, never from a component or the top level of a route file.

### 5b. Quickest test: a script

Create `apps/web/scripts/send-test-email.ts`:

```ts
import { sendEmail } from "../src/lib/email.server.ts";

const to = process.argv[2];
if (!to) {
  throw new Error("Usage: pnpm --filter web send-test-email you@example.com");
}

const result = await sendEmail({
  to,
  subject: "Venture Accounts test email",
  html: "<p>If you can read this, Resend is working.</p>",
});
console.log("Sent:", result);
```

Add a script to `apps/web/package.json`, next to `create-user`:

```json
"send-test-email": "tsx scripts/send-test-email.ts"
```

Run it with **the address you signed up to Resend with** (anything else is rejected while you are on `onboarding@resend.dev`):

```bash
pnpm --filter web send-test-email you@example.com
```

Expected: it prints `Sent: { id: '...' }` and the email arrives within a few seconds (check spam the first time). Then open the dashboard -> **Emails**: you should see it listed as **Delivered**.

### 5c. Sending from inside the app: a server function

This is the shape real features (password resets, statements, notifications) will use. Put it in a route's `-components` file like the project's other `*-fn.ts` files:

```ts
import { requireAdmin } from "#/lib/require-admin.server.ts";
import { sendEmail } from "#/lib/email.server.ts";
import { createServerFn } from "@tanstack/react-start";

export const sendTestEmail = createServerFn({ method: "POST" })
  .validator((to: string) => to)
  .handler(async ({ data: to }) => {
    // Never expose an unauthenticated "send an email" endpoint - anyone could
    // use it to spam from your domain. Restrict it, as here, to admins.
    await requireAdmin();
    await sendEmail({
      to,
      subject: "Venture Accounts test email",
      html: "<p>Sent from a server function.</p>",
    });
  });
```

Call it from a button's `onClick` with `await sendTestEmail({ data: "you@example.com" })`.

## 6. Send from your own domain

`onboarding@resend.dev` is only for testing. To email anyone, from an address like `accounts@yourchurch.org.za`, Resend has to verify you own the domain. This is done with DNS records, which prove to receiving mail servers (Gmail, Outlook...) that the mail is genuine and keep it out of spam.

1. Dashboard -> **Domains** -> **Add Domain**.
2. Enter a **subdomain** rather than your main domain - e.g. `mail.yourchurch.org.za`. That keeps this mail's reputation separate from your everyday email and avoids clashing with the records your normal mail provider already uses.
3. Pick the region closest to your recipients (e.g. Ireland or São Paulo; there is no African region at the time of writing - check the dropdown).
4. Resend now lists the DNS records to create. They are normally:
   - an **MX** record and a **TXT (SPF)** record, on a `send` sub-label of the domain you entered, and
   - a **TXT (DKIM)** record at `resend._domainkey` (a long public key).

   The exact names and values are shown in the dashboard - **copy them from there**, not from this document.
5. Sign in to wherever the domain's DNS is managed (the registrar - e.g. Afrihost, Domains.co.za, GoDaddy - or Cloudflare if the domain uses it) and add each record exactly as shown. Two common slips: some DNS hosts append the domain name automatically, so you enter `resend._domainkey` rather than the full name; and pasted values must have no extra quotes or spaces.
6. Back in Resend, press **Verify DNS Records**. Propagation usually takes minutes but can take up to a day; the status moves from *Pending* to *Verified*.
7. Optional but recommended: add a **DMARC** TXT record at `_dmarc` (Resend's DNS page links to guidance). A starting value is `v=DMARC1; p=none; rua=mailto:you@yourchurch.org.za`, which only reports on mail and doesn't block anything yet.

Once the domain shows **Verified**:

1. Change `EMAIL_FROM` in `.env` (and in Railway) to an address on that domain, e.g. `Venture Accounts <accounts@mail.yourchurch.org.za>`. The part before the `@` can be anything; the domain must be the verified one.
2. Optionally create a new API key restricted to that domain (step 2) and replace the old one.
3. Re-run the test from step 5b, now with **any** recipient address.

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Couldn't send email: API key is invalid` | Wrong or truncated key, a stray space/quote in `.env`, or the dev server wasn't restarted after editing `.env`. |
| `You can only send testing emails to your own email address` | Still using `onboarding@resend.dev` with a recipient that isn't the account owner. Verify a domain (step 6). |
| `The ... domain is not verified` | `EMAIL_FROM` uses a domain that is not yet **Verified** in the dashboard, or has a typo. |
| App refuses to start, naming `RESEND_API_KEY` or `EMAIL_FROM` | The variable is missing in that environment (e.g. Railway) - `@app/env` validates at startup. |
| Sent, but nothing arrives | Open **Emails** in the dashboard and click the message: it shows *Delivered*, *Bounced* or *Complained*, with the reason. Also check spam, and that DNS (SPF/DKIM) is verified. |
| White screen / hydration errors after adding email code | A server-only import (`email.server.ts`, `@app/env`) is reachable from browser code. Move it inside a `createServerFn` handler. |

## 8. Before relying on it in production

- Use a separate production API key, stored only in the hosting platform's environment, never committed.
- Keep every send behind authentication or an internal trigger (see the `requireAdmin()` note in 5c).
- Send small, plain transactional messages (receipts, statements, password resets). Bulk or marketing mail needs unsubscribe handling and is a different use of the service.
- Rotate the key (create new, deploy, delete old) if it is ever pasted into chat, a screenshot or a commit.

## Further reading

- Resend docs - quickstart: <https://resend.com/docs/introduction>
- Verifying a domain: <https://resend.com/docs/dashboard/domains/introduction>
- Node.js SDK: <https://resend.com/docs/send-with-nodejs>
