import { auth } from "#/lib/auth.ts";
import { sendInvitationEmail } from "#/lib/invitation.server.ts";
import { requireAdmin } from "#/lib/require-admin.server.ts";
import { authAccount, db, session, user } from "@app/db/direct";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, eq } from "drizzle-orm";

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
  role: string;
};

// Creates a user and emails them an invitation to choose their own password
// (see sendInvitationEmail). They're created without a password - so they
// can't sign in until they accept - and already marked as verified, since
// the only way to get a password is the link sent to their address. A failed
// invitation email doesn't undo the creation - it comes back in
// invitationEmailError instead, and can be re-sent (sendUserInvitation).
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
    const role = USER_ROLES.find((known) => known === data.role);
    if (!role) {
      throw new Error("Unknown role.");
    }

    const { user: created } = await auth.api.createUser({
      body: { email, name, role, data: { emailVerified: true } },
      headers: getRequest().headers,
    });

    let invitationEmailError: string | null = null;
    try {
      await sendInvitationEmail({ id: created.id, name, email });
    } catch (caught) {
      invitationEmailError =
        caught instanceof Error ? caught.message : "The email couldn't be sent.";
    }

    return { id: created.id, invitationEmailError };
  });

// (Re-)sends the invitation to a user who hasn't set a password yet.
export const sendUserInvitation = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    const [target] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, id));
    if (!target) {
      throw new Error("User not found.");
    }
    const [credential] = await db
      .select({ id: authAccount.id })
      .from(authAccount)
      .where(and(eq(authAccount.userId, id), eq(authAccount.providerId, "credential")));
    if (credential) {
      throw new Error("This user has already set a password.");
    }
    await sendInvitationEmail(target);
  });

// Sends (or re-sends) the verification email to a user who hasn't verified
// their address yet. The link in it is built by better-auth from
// BETTER_AUTH_URL and sent through Resend (see sendVerificationEmail in
// lib/auth.ts). Throws if the email couldn't be sent.
export const sendUserVerificationEmail = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    const [target] = await db
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, id));
    if (!target) {
      throw new Error("User not found.");
    }
    if (target.emailVerified) {
      throw new Error("This user's email address is already verified.");
    }
    await auth.api.sendVerificationEmail({
      body: { email: target.email, callbackURL: "/books" },
    });
  });
