import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  advanced: {
    cookiePrefix: "better-auth",
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  database: new Pool({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [process.env.FRONTEND_ORIGIN_LOCAL!, process.env.FRONTEND_ORIGIN_PROD!].filter(Boolean),
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_OAUTH_CLIENT as string,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET as string,
    },
  },
});
