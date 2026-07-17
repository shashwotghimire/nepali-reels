import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { emailQueue } from "../queue/email.queue";
import { welcomeEmailTemplate } from "../utils/email-templates.util";

export const auth = betterAuth({
  advanced: {
    cookiePrefix: "better-auth",
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  account: {
    storeStateStrategy: "database",
  },
  database: new Pool({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: true,
  }),
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [process.env.FRONTEND_ORIGIN_LOCAL!, process.env.FRONTEND_ORIGIN_PROD!].filter(Boolean),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { subject, html } = welcomeEmailTemplate(user.name);
          await emailQueue.add("welcome", { to: user.email, subject, html });
        },
      },
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_OAUTH_CLIENT as string,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET as string,
    },
  },
});
