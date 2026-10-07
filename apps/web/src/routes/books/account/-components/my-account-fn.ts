import { requireUser } from "#/lib/require-user.server.ts";
import { db, user } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

// Keep ALL database code inside handlers - see transactions-fn.ts for why.

// The avatar is a small square JPEG made in the browser and stored in
// user.image as a data URL, so it needs no file storage and works anywhere
// the session's `image` is used as an <img src>.
const AVATAR_PREFIX = "data:image/jpeg;base64,";
const MAX_AVATAR_LENGTH = 100_000;

type MyProfileInput = {
  name: string;
  /** A data URL from the avatar picker, or null to remove the avatar. */
  image: string | null;
};

// Updates the signed-in user's own details. The id comes from the session,
// never from the browser, so nobody can edit anyone else's profile here.
export const updateMyProfile = createServerFn({ method: "POST" })
  .validator((data: MyProfileInput) => data)
  .handler(async ({ data }) => {
    const { id } = await requireUser();
    const name = data.name.trim();
    if (!name) {
      throw new Error("Name is required.");
    }
    if (
      data.image !== null &&
      (!data.image.startsWith(AVATAR_PREFIX) || data.image.length > MAX_AVATAR_LENGTH)
    ) {
      throw new Error("The avatar must be a small JPEG image.");
    }
    await db
      .update(user)
      .set({ name, image: data.image, updatedAt: new Date() })
      .where(eq(user.id, id));
  });
