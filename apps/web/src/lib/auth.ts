import { env } from "@app/env";
import { authAccount, db, session, user, verification } from "@app/db/direct";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schemaName: "auth",
    schema: { user, session, account: authAccount, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Explicit rather than relying on the isProduction default, so dev/staging
  // are protected too and behavior doesn't silently depend on NODE_ENV.
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
  },
  // Must be last (see better-auth/tanstack-start docs).
  plugins: [admin(), tanstackStartCookies()],
});
