import { env } from "@app/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(options: { to: string | string[]; subject: string; html: string; }) {
   const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      ...options,
   });

   // The SDK reports failures in `error` instead of throwing - always check it.
   if (error) {
      throw new Error(`Couldn't send email: ${error.message}`);
   }
   return data; // { id: "..." } - the id you can look up in the dashboard
}
