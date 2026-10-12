import { sendEmail } from "@app/email/send";
import { requireAdmin } from "#/lib/require-admin.server.ts";
import { createServerFn } from "@tanstack/react-start";

export const sendTestEmail = createServerFn({ method: "POST" })
   .validator((to: string) => to)
   .handler(async ({ data: to }) => {
      // Never expose an unauthenticated "send an email" endpoint - anyone could
      // use it to spam from your domain. Restrict it, as here, to admins.
      await requireAdmin();
      await sendEmail({
         to,
         subject: "Venture Accounts test server-sent email",
         html: "<p>Sent from a server function.</p>",
      });
   });
