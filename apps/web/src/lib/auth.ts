import { accounts, sessions, users, verifications } from "@opensesh/domain/db/auth";
import { MailError } from "@opensesh/domain/server/errors";
import { makeMailLive, sendMagicLink } from "@opensesh/domain/server/mail";
import { run } from "@opensesh/domain/server/runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import { Effect } from "effect";

export interface CapturedMagicLink {
  readonly token: string;
  readonly url: string;
}

export const makeAuth = (
  env: Cloudflare.Env,
  origin: string,
  capture?: (link: CapturedMagicLink) => void,
) => {
  const demoMode = env.DEMO_MODE === "1";
  const mailLive = makeMailLive(env.DB, demoMode, (mail) =>
    Effect.tryPromise({
      try: () =>
        env.EMAIL.send({
          to: mail.to,
          from: env.MAIL_FROM,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }).then(() => undefined),
      catch: (cause) => new MailError({ message: "Could not send email", cause }),
    }),
  );

  return betterAuth({
    appName: "opensesh",
    baseURL: origin,
    trustedOrigins: [origin],
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema: { users, sessions, accounts, verifications },
    }),
    user: { modelName: "users" },
    session: {
      modelName: "sessions",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: { cookiePrefix: "opensesh" },
    plugins: [
      magicLink({
        disableSignUp: false,
        storeToken: "hashed",
        sendMagicLink: async ({ email, token, url }) => {
          capture?.({ token, url });
          const result = await run(
            sendMagicLink({ eventSlug: "ai-engineer-nyc-2026", email, url }),
            mailLive,
          );
          if (!result.ok) {
            return await Promise.reject(new Error(result.error.message));
          }
        },
      }),
      tanstackStartCookies(),
    ],
  });
};
