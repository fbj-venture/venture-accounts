import { env } from "@app/env";
import { authAccount, db, session, user, verification } from "@app/db/direct";
import { and, count, eq, gt, like } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { APP_COMPANY } from "./app-company.ts";
import { renderResetPasswordEmail, renderVerifyEmail } from "@app/email";
import { sendEmail } from "@app/email/send";

// Email clients load images from the web, so this must be a public absolute URL
// (file is apps/web/public/img/venture-church.png). It will show broken in
// emails sent from localhost.
export const EMAIL_LOGO_URL = new URL("/img/venture-church.png", env.BETTER_AUTH_URL).toString();

// Most reset emails one address gets in an hour.
const RESET_EMAILS_PER_HOUR = 3;

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schemaName: "auth",
    schema: { user, session, account: authAccount, verification },
  }),
  // Sign-in is refused until the user's email is verified. Users an admin
  // creates without ticking "require email verification" are saved as
  // already verified (see createUser in admin/users/-components/users-fn.ts),
  // so they can sign in straight away with the password they were given.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Forgot-password links last an hour (invitation links are made
    // separately and last longer - see invitation.server.ts).
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user: target, url }) => {
      // Per-address cap, on top of the per-IP limit on the endpoint below:
      // however many IPs a flood comes from, one mailbox gets at most
      // RESET_EMAILS_PER_HOUR emails an hour. Skipped silently - the caller
      // is told the same thing either way so it can't probe for accounts.
      const [{ recent } = { recent: 0 }] = await db
        .select({ recent: count() })
        .from(verification)
        .where(
          and(
            eq(verification.value, target.id),
            like(verification.identifier, "reset-password:%"),
            gt(verification.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
          ),
        );
      if (recent > RESET_EMAILS_PER_HOUR) {
        return;
      }
      await sendEmail({
        to: target.email,
        subject: `Reset your ${APP_COMPANY} Accounts password`,
        html: await renderResetPasswordEmail({ name: target.name, company: APP_COMPANY, url, logoUrl: EMAIL_LOGO_URL }),
      });
    },
  },
  emailVerification: {
    // An unverified user who tries to sign in is sent a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Verify your email address for ${APP_COMPANY} Accounts`,
        html: await renderVerifyEmail({ name: user.name, company: APP_COMPANY, url, logoUrl: EMAIL_LOGO_URL }),
      });
    },
  },
  // Explicit rather than relying on the isProduction default, so dev/staging
  // are protected too and behavior doesn't silently depend on NODE_ENV.
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
    // Each of these sends an email (or tries passwords), so they get a much
    // tighter per-IP limit than the general one: 5 requests per 15 minutes.
    customRules: {
      "/request-password-reset": { window: 15 * 60, max: 5 },
      "/send-verification-email": { window: 15 * 60, max: 5 },
    },
  },
  // Must be last (see better-auth/tanstack-start docs).
  plugins: [admin(), tanstackStartCookies()],
});
