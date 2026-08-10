import { makeDatabase } from "@opensesh/domain/server/db";
import {
  accounts,
  organizationInvitations,
  organizationMembers,
  organizations,
  sessions,
  users,
  verifications,
} from "@opensesh/domain/db/auth";
import { MailError } from "@opensesh/domain/server/errors";
import { makeMailLive, sendMagicLink } from "@opensesh/domain/server/mail";
import { run } from "@opensesh/domain/server/runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Effect } from "effect";

export interface CapturedMagicLink {
  readonly token: string;
  readonly url: string;
}

const DEMO_ORGANIZATION_ID = "org_ai_engineer";

export const makeAuth = (
  env: Cloudflare.Env,
  origin: string,
  capture?: (link: CapturedMagicLink) => void,
) => buildAuth(env, origin, capture);

const buildAuth = (
  env: Cloudflare.Env,
  origin: string,
  capture?: (link: CapturedMagicLink) => void,
) => {
  const demoMode = env.DEMO_MODE === "1";
  const connectionString = env.HYPERDRIVE.connectionString;
  const database = makeDatabase(connectionString);
  const mailLive = makeMailLive(connectionString, demoMode, (mail) =>
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
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        users,
        sessions,
        accounts,
        verifications,
        organizations,
        organizationMembers,
        organizationInvitations,
      },
    }),
    user: { modelName: "users" },
    session: {
      modelName: "sessions",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Session checks guard every navigation and server fn; the signed
      // cookie cache answers them without touching the database. Revocation
      // lags by at most maxAge, which the demo accepts.
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: { cookiePrefix: "opensesh" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await database
              .insert(organizationMembers)
              .values({
                organizationId: DEMO_ORGANIZATION_ID,
                userId: user.id,
                role: "member",
              })
              .onConflictDoNothing();
          },
        },
      },
    },
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
      organization({
        schema: {
          organization: { modelName: "organizations" },
          member: { modelName: "organizationMembers" },
          invitation: { modelName: "organizationInvitations" },
        },
      }),
      tanstackStartCookies(),
    ],
  });
};
