import { ENV } from "varlock/env"
import { authAccount, db, session, user, verification } from "@app/db/direct"
import { and, count, eq, gt, like } from "drizzle-orm"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { admin } from "better-auth/plugins"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { renderResetPasswordEmail, renderVerifyEmail } from "@app/email"
import { sendEmail } from "@app/email/send"
import { getCompanyName } from "./company-name.server.ts"
import { MIN_PASSWORD_LENGTH, passwordProblem } from "./password-policy.ts"

// Email clients load images from the web, so this must be a public absolute URL
// (file is apps/web/public/img/venture-church.png). It will show broken in
// emails sent from localhost.
export const EMAIL_LOGO_URL = new URL("/img/venture-church.png", ENV.BETTER_AUTH_URL).toString()

// Endpoints whose body carries a new password (checked against the password
// policy in the hooks below). sign-up/email is disabled but listed anyway.
const PASSWORD_PATHS = [
  "/reset-password",
  "/change-password",
  "/set-password",
  "/admin/set-user-password",
]

// Most reset emails one address gets in an hour.
const RESET_EMAILS_PER_HOUR = 3

export const auth = betterAuth({
  baseURL: ENV.BETTER_AUTH_URL,
  trustedOrigins: [
    ENV.BETTER_AUTH_URL,
    ...(ENV.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
  secret: ENV.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schemaName: "auth",
    schema: { user, session, account: authAccount, verification },
  }),
  // Sign-in is refused until the user's email is verified, and nobody - admins
  // included - can mark an email verified by hand (see hooks below). It only
  // happens by the user proving they control the mailbox: following the
  // verification link, or using an invitation / password-reset link
  // (onPasswordReset).
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    // Users are invited by an admin; this closes POST /api/auth/sign-up/email.
    // Admin-created users go through the admin plugin's createUser, which this
    // doesn't affect.
    disableSignUp: true,
    requireEmailVerification: true,
    // Forgot-password links last an hour (invitation links are made
    // separately and last longer - see invitation.server.ts).
    resetPasswordTokenExpiresIn: 60 * 60,
    // The reset/invitation token was only ever emailed to this address, so
    // using it verifies the address.
    onPasswordReset: async ({ user: target }) => {
      if (!target.emailVerified) {
        await db.update(user).set({ emailVerified: true }).where(eq(user.id, target.id))
      }
    },
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
        )
      if (recent > RESET_EMAILS_PER_HOUR) {
        return
      }
      const companyName = await getCompanyName()
      await sendEmail({
        to: target.email,
        subject: `Reset your ${companyName} Accounts password`,
        html: await renderResetPasswordEmail({
          name: target.name,
          company: companyName,
          url,
          logoUrl: EMAIL_LOGO_URL,
        }),
      })
    },
  },
  emailVerification: {
    // An unverified user who tries to sign in is sent a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const companyName = await getCompanyName()
      await sendEmail({
        to: user.email,
        subject: `Verify your email address for ${companyName} Accounts`,
        html: await renderVerifyEmail({
          name: user.name,
          company: companyName,
          url,
          logoUrl: EMAIL_LOGO_URL,
        }),
      })
    },
  },
  // Google is only offered when its credentials are set. Users are invited, so
  // Google can never create an account (disableSignUp), and it can only be
  // linked from My Account by a user who is already signed in (so has set a
  // password). Invited users are created already email-verified, so without
  // disableImplicitLinking below, a Google sign-in with the same email would
  // link itself and skip choosing a password.
  socialProviders:
    ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: ENV.GOOGLE_CLIENT_ID,
            clientSecret: ENV.GOOGLE_CLIENT_SECRET,
            disableSignUp: true,
          },
        }
      : {},
  // allowDifferentEmails: a signed-in user may link a Google account whose
  // email differs from their login email.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      disableImplicitLinking: true,
      allowDifferentEmails: true,
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
  // The session is checked against a signed cookie for 5 minutes before going
  // back to the database, so navigating doesn't query it every time. Keep in
  // step with SESSION_STALE_TIME (routes/books/-lib/session-query.ts).
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  // The admin plugin lets an admin pass emailVerified when creating or
  // updating a user; refuse it so verification can't be skipped.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = (ctx.body ?? {}) as { data?: Record<string, unknown>; newPassword?: unknown }
      // Every endpoint that stores a password, so the rules can't be skipped
      // by calling the API directly.
      if (PASSWORD_PATHS.includes(ctx.path)) {
        const problem = passwordProblem(
          typeof body.newPassword === "string" ? body.newPassword : "",
        )
        if (problem) {
          throw new APIError("BAD_REQUEST", { message: problem, code: "PASSWORD_POLICY" })
        }
        return
      }
      if (ctx.path !== "/admin/create-user" && ctx.path !== "/admin/update-user") {
        return
      }
      if (body.data && "emailVerified" in body.data) {
        throw new APIError("BAD_REQUEST", {
          message: "An email address can only be verified by its owner.",
        })
      }
    }),
  },
  // Must be last (see better-auth/tanstack-start docs).
  plugins: [admin(), tanstackStartCookies()],
})
