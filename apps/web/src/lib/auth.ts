import { env } from "@app/env";
import { authAccount, db, session, user, verification } from "@app/db/direct";
import { and, count, eq, gt, like } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { APP_COMPANY } from "./app-company.ts";
import { sendEmail } from "./email.server.ts";

// Most reset emails one address gets in an hour.
const RESET_EMAILS_PER_HOUR = 3;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
        html:
          `<p>Hi ${escapeHtml(target.name)},</p>` +
          `<p>We received a request to reset your ${escapeHtml(APP_COMPANY)} Accounts password. This link works for one hour:</p>` +
          `<p><a href="${url}">Reset my password</a></p>` +
          `<p>If you didn't ask for this, you can ignore this email - your password won't change.</p>`,
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
        html:
          `<p>Hi ${escapeHtml(user.name)},</p>` +
          `<p>Please confirm your email address to finish setting up your ${escapeHtml(APP_COMPANY)} Accounts login:</p>` +
          `<p><a href="${url}">Verify my email address</a></p>` +
          `<p>If you weren't expecting this, you can ignore this email.</p>`,
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
