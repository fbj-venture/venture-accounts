import { db, userAvatar } from "@app/db/direct"
import { eq } from "drizzle-orm"

const PREFIX = "data:image/jpeg;base64,"

// The JPEG bytes of a user's avatar (see user_avatar in @app/db), or null.
export async function getAvatarJpeg(userId: string) {
  const [row] = await db
    .select({ data: userAvatar.data })
    .from(userAvatar)
    .where(eq(userAvatar.userId, userId))
  if (!row?.data.startsWith(PREFIX)) {
    return null
  }
  return Buffer.from(row.data.slice(PREFIX.length), "base64")
}
