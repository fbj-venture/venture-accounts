import { db, user } from "@app/db/direct";
import { requireAdmin } from "#/lib/require-admin.server.ts";
import { createServerFn } from "@tanstack/react-start";
import { asc } from "drizzle-orm";

// Keep ALL database code inside handlers - see transactions-fn.ts for why.
// Never select password hashes or session tokens here: this list is for
// display, and only needs the user's own profile columns.
export type AppUser = Awaited<ReturnType<typeof getUsers>>[number];

export const getUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name));
});
