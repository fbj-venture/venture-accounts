import { env } from "@app/env";
import { randomBytes } from "node:crypto";
import { auth, EMAIL_LOGO_URL } from "./auth.ts";
import { APP_COMPANY } from "./app-company.ts";
import { renderInvitationEmail } from "@app/email";
import { sendEmail } from "@app/email/send";

// How long an invitation link works for.
const INVITATION_DAYS = 7;

// Emails a user a link to /set-password, where they choose their password.
// The link carries one of better-auth's own password-reset tokens (so the
// reset endpoint that the page calls validates and consumes it), made here
// directly rather than through requestPasswordReset so the email can say
// "you're invited" and last longer than a forgotten-password link. Setting a
// password this way also creates the user's credential account if they
// don't have one yet. Server-only; throws if the email can't be sent.
export async function sendInvitationEmail(user: { id: string; name: string; email: string }) {
  const context = await auth.$context;
  const token = randomBytes(18).toString("base64url");
  await context.internalAdapter.createVerificationValue({
    value: user.id,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
  });

  const url = new URL("/set-password", env.BETTER_AUTH_URL);
  url.searchParams.set("token", token);

  await sendEmail({
    to: user.email,
    subject: `You've been invited to ${APP_COMPANY} Accounts`,
    html: await renderInvitationEmail({
      name: user.name,
      company: APP_COMPANY,
      url: url.toString(),
      validDays: INVITATION_DAYS,
      logoUrl: EMAIL_LOGO_URL,
    }),
  });
}
