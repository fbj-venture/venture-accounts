import { authAccount, db, session, user, verification } from "@app/db/direct";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schemaName: "auth",
    schema: { user, session, account: authAccount, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Must be last (see better-auth/tanstack-start docs).
  plugins: [tanstackStartCookies()],
});
