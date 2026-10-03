import { auth } from "#/lib/auth.ts";
import { requireAdmin } from "#/lib/require-admin.server.ts";
import { db, session, user } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { asc, eq } from "drizzle-orm";

// The roles the admin plugin knows by default.
export const USER_ROLES = ["admin", "user"] as const;

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

export type AppUserDetails = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export const getUser = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, id));
    return row ?? null;
  });

// Deactivating a user is better-auth's admin-plugin "ban": it blocks sign-in
// and ends the user's current sessions. The calls run as the signed-in admin
// (their request headers), which the plugin re-checks.
// The reason is mandatory and stored as the ban reason, so it's there for
// whoever looks at the user later.
export const deactivateUser = createServerFn({ method: "POST" })
  .validator((data: { id: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const reason = data.reason.trim();
    if (!reason) {
      throw new Error("A reason is required to deactivate a user.");
    }

    if (data.id === admin.id) {
      // The plugin refuses to ban the admin making the call, so an admin
      // deactivating their own account gets the same effect by hand: flag the
      // user as banned (no expiry) and end all their sessions. Nobody can
      // reactivate them from the app afterwards unless another admin does.
      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ banned: true, banReason: reason, banExpires: null })
          .where(eq(user.id, admin.id));
        await tx.delete(session).where(eq(session.userId, admin.id));
      });
      return;
    }

    await auth.api.banUser({
      body: { userId: data.id, banReason: reason },
      headers: getRequest().headers,
    });
  });

export const reactivateUser = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    await auth.api.unbanUser({ body: { userId: id }, headers: getRequest().headers });
  });

// Updates a user's name and role through the admin plugin, which re-checks
// that the caller may. A role change goes through setRole (the plugin
// validates it against its known roles).
export const updateUser = createServerFn({ method: "POST" })
  .validator((data: { id: string; name: string; role: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const name = data.name.trim();
    if (!name) {
      throw new Error("Name is required.");
    }
    const role = USER_ROLES.find((known) => known === data.role);
    if (!role) {
      throw new Error("Unknown role.");
    }
    const headers = getRequest().headers;
    const [current] = await db.select({ role: user.role }).from(user).where(eq(user.id, data.id));
    if (!current) {
      throw new Error("User not found.");
    }
    await auth.api.adminUpdateUser({ body: { userId: data.id, data: { name } }, headers });
    if (current.role !== role) {
      await auth.api.setRole({ body: { userId: data.id, role }, headers });
    }
  });

// Permanently removes the user, their sessions and their sign-in accounts
// (the plugin's removeUser). It refuses to delete the admin making the call.
export const deleteUser = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const admin = await requireAdmin();
    if (id === admin.id) {
      throw new Error("You can't delete your own account.");
    }
    await auth.api.removeUser({ body: { userId: id }, headers: getRequest().headers });
  });

type NewUserInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  /** Unticked: the user is saved as already verified and can sign in at once. */
  requireVerification: boolean;
};

// Creates a user (and their email + password login) through the admin
// plugin. With requireVerification they're created unverified, and sign-in
// stays blocked until they follow the link in the verification email sent
// here (and re-sent whenever they try to sign in). Without it they're saved
// as already verified. A failed verification email doesn't undo the
// creation - it comes back in verificationEmailError instead.
export const createUser = createServerFn({ method: "POST" })
  .validator((data: NewUserInput) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    if (!name) {
      throw new Error("Name is required.");
    }
    if (!email) {
      throw new Error("Email is required.");
    }
    // better-auth's own limits: 8 to 128 characters.
    if (data.password.length < 8 || data.password.length > 128) {
      throw new Error("The password must be between 8 and 128 characters.");
    }
    if (data.password !== data.confirmPassword) {
      throw new Error("The passwords don't match.");
    }
    const role = USER_ROLES.find((known) => known === data.role);
    if (!role) {
      throw new Error("Unknown role.");
    }

    const headers = getRequest().headers;
    const { user: created } = await auth.api.createUser({
      body: {
        email,
        password: data.password,
        name,
        role,
        data: { emailVerified: !data.requireVerification },
      },
      headers,
    });

    let verificationEmailError: string | null = null;
    if (data.requireVerification) {
      try {
        await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/books" } });
      } catch (caught) {
        verificationEmailError =
          caught instanceof Error ? caught.message : "The email couldn't be sent.";
      }
    }

    return { id: created.id, verificationEmailError };
  });
