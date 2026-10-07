import { render } from "@react-email/render";
import { InvitationEmail, type InvitationEmailProps } from "./templates/invitation.js";
import { ResetPasswordEmail, type ResetPasswordEmailProps } from "./templates/reset-password.js";
import { VerifyEmail, type VerifyEmailProps } from "./templates/verify-email.js";

export function renderResetPasswordEmail(props: ResetPasswordEmailProps) {
  return render(ResetPasswordEmail(props));
}

export function renderVerifyEmail(props: VerifyEmailProps) {
  return render(VerifyEmail(props));
}

export function renderInvitationEmail(props: InvitationEmailProps) {
  return render(InvitationEmail(props));
}

export { InvitationEmail, ResetPasswordEmail, VerifyEmail };
export type { InvitationEmailProps, ResetPasswordEmailProps, VerifyEmailProps };
