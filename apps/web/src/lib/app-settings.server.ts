// Server-only: import it only inside server function handlers, so it - and
// the database driver - stay out of the browser bundle (see
// routes/books/banking/transactions/-components/posting.server.ts).
import { db, settings } from "@app/db/direct";
import { eq } from "drizzle-orm";

// The user's app_settings row. A user with none gets one created with the
// table's default values, then it is read back - so the returned row always
// carries the stored values, never numbers invented here.
export async function getOrCreateSettings(userId: string) {
  const find = async () => {
    const [row] = await db.select().from(settings).where(eq(settings.userId, userId));
    return row;
  };

  const existing = await find();
  if (existing) {
    return existing;
  }

  // Two requests can race to create the first row (e.g. two tabs opening
  // right after sign-in): the unique user_id lets one win and the other do
  // nothing, and both then read the same row.
  await db.insert(settings).values({ userId }).onConflictDoNothing({ target: settings.userId });

  const created = await find();
  if (!created) {
    throw new Error("Couldn't create the app settings for this user.");
  }
  return created;
}
