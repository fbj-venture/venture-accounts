import { ENV } from "varlock/env"
import { requireUser } from "#/lib/require-user.server.ts"
import { authAccount, db, user, userAvatar } from "@app/db/direct"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"

// Keep ALL database code inside handlers - see transactions.server.ts for why.

// The avatar is a small square JPEG made in the browser. The picture itself
// goes in user_avatar and is served by /api/avatar/$userId; user.image holds
// only that short URL, because better-auth copies the whole user into the
// session cookie and a picture there overflows the response headers.
const AVATAR_PREFIX = "data:image/jpeg;base64,"
const MAX_AVATAR_LENGTH = 100_000

type MyProfileInput = {
  name: string
  /**
   * A data URL from the avatar picker (a new picture), null (remove the
   * avatar), or the current avatar URL back again (leave it alone).
   */
  image: string | null
}

// Updates the signed-in user's own details. The id comes from the session,
// never from the browser, so nobody can edit anyone else's profile here.
export const updateMyProfile = createServerFn({ method: "POST" })
  .validator((data: MyProfileInput) => data)
  .handler(async ({ data }) => {
    const { id } = await requireUser()
    const name = data.name.trim()
    if (!name) {
      throw new Error("Name is required.")
    }
    const newPicture = data.image?.startsWith("data:") ? data.image : null
    if (
      newPicture !== null &&
      (!newPicture.startsWith(AVATAR_PREFIX) || newPicture.length > MAX_AVATAR_LENGTH)
    ) {
      throw new Error("The avatar must be a small JPEG image.")
    }
    const now = new Date()
    await db.transaction(async (tx) => {
      const profile: { name: string; updatedAt: Date; image?: string | null } = {
        name,
        updatedAt: now,
      }
      if (newPicture !== null) {
        await tx
          .insert(userAvatar)
          .values({ userId: id, data: newPicture, updatedAt: now })
          .onConflictDoUpdate({
            target: userAvatar.userId,
            set: { data: newPicture, updatedAt: now },
          })
        // ?v changes with each picture so browsers don't keep showing the old one.
        profile.image = `/api/avatar/${id}?v=${now.getTime()}`
      } else if (data.image === null) {
        await tx.delete(userAvatar).where(eq(userAvatar.userId, id))
        profile.image = null
      }
      await tx.update(user).set(profile).where(eq(user.id, id))
    })
  })

// Whether Google sign-in is set up on this server, and whether the signed-in
// user has already linked a Google account.
export const getGoogleLinkState = createServerFn({ method: "GET" }).handler(async () => {
  const { id } = await requireUser()
  const [linked] = await db
    .select({ id: authAccount.id })
    .from(authAccount)
    .where(and(eq(authAccount.userId, id), eq(authAccount.providerId, "google")))
    .limit(1)
  return {
    available: Boolean(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET),
    linked: Boolean(linked),
  }
})
