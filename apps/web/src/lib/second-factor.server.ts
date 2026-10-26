import { db, passkey, recoveryCode, session as sessionTable } from "@app/db/direct"
import { and, count, eq, gte, isNull, lt } from "drizzle-orm"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import type { BetterAuthPlugin } from "better-auth"
import { z } from "zod"

// A password (or Google) sign-in starts a session that can do nothing but
// finish signing in: second_factor_verified is false until a passkey - or, in
// an emergency, a recovery code - has been proved in that session. A user
// with no confirmed recovery codes counts as not yet enrolled; their first
// session walks them through creating a passkey and saving the codes.
//
// Rules this plugin enforces (the passkey plugin only knows about passkeys):
//  - an unverified session may only call the endpoints in OPEN_PATHS;
//  - it can add a passkey only while the user is not enrolled, so someone with
//    just a stolen password can't add their own to an enrolled account;
//  - passkey sign-in works only inside such a session, for that same user, and
//    only once the user is enrolled (see requireEnrolledSameUser).

const RECOVERY_CODE_COUNT = 10
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789" // no I, L, O, U, 0, 1

// Paths an unverified session may still call.
const OPEN_PATHS = [
  "/get-session",
  "/sign-out",
  "/sign-in/",
  "/callback/",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/list-user-passkeys",
  "/second-factor/",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
]

const REGISTER_PATHS = ["/passkey/generate-register-options", "/passkey/verify-registration"]

function hashCode(code: string) {
  const normalised = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return createHash("sha256").update(normalised).digest("hex")
}

function newCode() {
  const bytes = randomBytes(10)
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`
}

export async function countPasskeys(userId: string) {
  const [row] = await db.select({ n: count() }).from(passkey).where(eq(passkey.userId, userId))
  return row?.n ?? 0
}

// Enrolled = the user has confirmed (saved) their recovery codes.
export async function isEnrolled(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(recoveryCode)
    .where(and(eq(recoveryCode.userId, userId), isNull(recoveryCode.enrolmentSessionId)))
  return (row?.n ?? 0) > 0
}

export async function unusedRecoveryCodes(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(recoveryCode)
    .where(
      and(
        eq(recoveryCode.userId, userId),
        isNull(recoveryCode.enrolmentSessionId),
        isNull(recoveryCode.usedAt),
      ),
    )
  return row?.n ?? 0
}

// Whether the session has passed the second factor. The session cookie's cache
// can be up to five minutes behind the database, so a "no" is double-checked.
export async function isSessionVerified(sessionId: string, cachedVerified: boolean) {
  if (cachedVerified) {
    return true
  }
  const [row] = await db
    .select({ verified: sessionTable.secondFactorVerified })
    .from(sessionTable)
    .where(eq(sessionTable.id, sessionId))
  return row?.verified === true
}

type EndpointContext = Parameters<typeof setSessionCookie>[0]

async function markVerified(
  ctx: EndpointContext,
  current: { session: { id: string }; user: Parameters<typeof setSessionCookie>[1]["user"] },
) {
  const [updated] = await db
    .update(sessionTable)
    .set({ secondFactorVerified: true })
    .where(eq(sessionTable.id, current.session.id))
    .returning()
  if (updated) {
    // Refresh the cookie cache so the new state is seen straight away.
    await setSessionCookie(ctx, {
      session: updated as unknown as Parameters<typeof setSessionCookie>[1]["session"],
      user: current.user,
    })
  }
}

// Called by the passkey plugin's authentication.afterVerification, before it
// creates the session: the assertion must come from the same user who is
// partway through signing in.
export async function requireEnrolledSameUser(ctx: unknown, credentialId: string) {
  const pending = await getSessionFromCtx(ctx as Parameters<typeof getSessionFromCtx>[0], {
    disableCookieCache: true,
  })
  if (!pending) {
    throw new APIError("UNAUTHORIZED", { message: "Sign in with your password first." })
  }
  const [key] = await db
    .select({ userId: passkey.userId })
    .from(passkey)
    .where(eq(passkey.credentialID, credentialId))
  if (!key || key.userId !== pending.user.id) {
    throw new APIError("UNAUTHORIZED", { message: "That passkey doesn't belong to this account." })
  }
  if (!(await isEnrolled(pending.user.id))) {
    throw new APIError("FORBIDDEN", {
      message: "Finish setting up your passkey and recovery codes first.",
    })
  }
}

export const secondFactor = () =>
  ({
    id: "second-factor",
    schema: {
      session: {
        fields: {
          secondFactorVerified: {
            type: "boolean",
            required: false,
            defaultValue: false,
            input: false,
          },
        },
      },
    },
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx)
            if (!current) {
              return
            }
            const cached =
              (current.session as { secondFactorVerified?: boolean }).secondFactorVerified === true
            if (await isSessionVerified(current.session.id, cached)) {
              return
            }
            if (!OPEN_PATHS.some((path) => ctx.path.startsWith(path))) {
              throw new APIError("FORBIDDEN", {
                message: "Finish signing in with your passkey first.",
                code: "SECOND_FACTOR_REQUIRED",
              })
            }
            if (REGISTER_PATHS.includes(ctx.path)) {
              if (await isEnrolled(current.user.id)) {
                throw new APIError("FORBIDDEN", {
                  message: "Use your existing passkey or a recovery code to sign in.",
                  code: "SECOND_FACTOR_REQUIRED",
                })
              }
              // Not enrolled, so any passkey on file is left over from an earlier
              // attempt that never finished. Clear them when a new attempt starts:
              // the passkey plugin tells the browser to refuse an authenticator
              // that already holds one, which stops the user switching from, say,
              // this device to their password manager.
              if (ctx.path === "/passkey/generate-register-options") {
                await db.delete(passkey).where(eq(passkey.userId, current.user.id))
              }
            }
          }),
        },
      ],
      after: [
        {
          // Passkey sign-in makes a brand new session (the one from the
          // password step stays behind, unverified, until it expires).
          matcher: (ctx) => ctx.path === "/passkey/verify-authentication",
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession
            if (created) {
              await markVerified(ctx as unknown as EndpointContext, created)
            }
          }),
        },
      ],
    },
    endpoints: {
      secondFactorStatus: createAuthEndpoint(
        "/second-factor/status",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const { session, user } = ctx.context.session
          const verified = await isSessionVerified(
            session.id,
            (session as { secondFactorVerified?: boolean }).secondFactorVerified === true,
          )
          const passkeys = await countPasskeys(user.id)
          const enrolled = await isEnrolled(user.id)
          return ctx.json({ verified, enrolled, hasPasskey: passkeys > 0 })
        },
      ),

      // Makes a fresh set of recovery codes and returns them - the only time
      // they're ever visible. While enrolling, the codes belong to this session
      // until completeEnrolment confirms them; an enrolled user (already
      // verified) replaces their codes straight away.
      generateRecoveryCodes: createAuthEndpoint(
        "/second-factor/recovery-codes",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const { session, user } = ctx.context.session
          const verified = await isSessionVerified(
            session.id,
            (session as { secondFactorVerified?: boolean }).secondFactorVerified === true,
          )
          const enrolled = await isEnrolled(user.id)
          if (enrolled && !verified) {
            throw new APIError("FORBIDDEN", { message: "Sign in with your passkey first." })
          }
          if (!enrolled && !(await hasPasskeyFrom(user.id, session.createdAt))) {
            throw new APIError("BAD_REQUEST", { message: "Create your passkey first." })
          }
          const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newCode)
          await db.transaction(async (tx) => {
            // Replaces the old codes (confirmed, or left over from an
            // abandoned enrolment).
            await tx.delete(recoveryCode).where(eq(recoveryCode.userId, user.id))
            await tx.insert(recoveryCode).values(
              codes.map((code) => ({
                id: randomUUID(),
                userId: user.id,
                codeHash: hashCode(code),
                enrolmentSessionId: enrolled ? null : session.id,
              })),
            )
          })
          return ctx.json({ codes })
        },
      ),

      // The user has a passkey made in this session and has been shown their
      // codes: confirm the codes, drop passkeys from before this sign-in (an
      // earlier, abandoned enrolment could have left some behind), and let the
      // session through.
      completeEnrolment: createAuthEndpoint(
        "/second-factor/complete-enrolment",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const current = ctx.context.session
          const { session, user } = current
          if (await isEnrolled(user.id)) {
            throw new APIError("BAD_REQUEST", { message: "Already set up." })
          }
          const [pending] = await db
            .select({ n: count() })
            .from(recoveryCode)
            .where(
              and(
                eq(recoveryCode.userId, user.id),
                eq(recoveryCode.enrolmentSessionId, session.id),
              ),
            )
          if (!pending?.n || !(await hasPasskeyFrom(user.id, session.createdAt))) {
            throw new APIError("BAD_REQUEST", {
              message: "Create a passkey and get your recovery codes first.",
            })
          }
          await db.transaction(async (tx) => {
            await tx
              .delete(passkey)
              .where(and(eq(passkey.userId, user.id), lt(passkey.createdAt, session.createdAt)))
            await tx
              .update(recoveryCode)
              .set({ enrolmentSessionId: null })
              .where(eq(recoveryCode.userId, user.id))
          })
          await markVerified(ctx as unknown as EndpointContext, current)
          return ctx.json({ ok: true })
        },
      ),

      useRecoveryCode: createAuthEndpoint(
        "/second-factor/use-recovery-code",
        {
          method: "POST",
          use: [sessionMiddleware],
          body: z.object({ code: z.string().min(1).max(64) }),
        },
        async (ctx) => {
          const current = ctx.context.session
          const { user } = current
          if (!(await isEnrolled(user.id))) {
            throw new APIError("FORBIDDEN", { message: "Set up your passkey first." })
          }
          // Single use: the UPDATE only matches a code not yet used.
          const [used] = await db
            .update(recoveryCode)
            .set({ usedAt: new Date() })
            .where(
              and(
                eq(recoveryCode.userId, user.id),
                eq(recoveryCode.codeHash, hashCode(ctx.body.code)),
                isNull(recoveryCode.enrolmentSessionId),
                isNull(recoveryCode.usedAt),
              ),
            )
            .returning({ id: recoveryCode.id })
          if (!used) {
            throw new APIError("UNAUTHORIZED", {
              message: "That recovery code isn't valid or was already used.",
            })
          }
          await markVerified(ctx as unknown as EndpointContext, current)
          return ctx.json({ remaining: await unusedRecoveryCodes(user.id) })
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === "/second-factor/use-recovery-code",
        window: 15 * 60,
        max: 10,
      },
    ],
  }) satisfies BetterAuthPlugin

async function hasPasskeyFrom(userId: string, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(passkey)
    .where(and(eq(passkey.userId, userId), gte(passkey.createdAt, since)))
  return (row?.n ?? 0) > 0
}
