import { env } from "@app/env";
import { authAccount, db, session, user, verification } from "@app/db/direct";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { sendEmail } from "./email.server.ts";

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
  },
  emailVerification: {
    // An unverified user who tries to sign in is sent a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Verify your email address for ${env.APP_COMPANY} Accounts`,
        html:
          `<p>Hi ${escapeHtml(user.name)},</p>` +
          `<p>Please confirm your email address to finish setting up your ${escapeHtml(env.APP_COMPANY)} Accounts login:</p>` +
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
  },
  // Must be last (see better-auth/tanstack-start docs).
  plugins: [admin(), tanstackStartCookies()],
});
