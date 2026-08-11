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
import { eventMembers, events } from "@opensesh/domain";
import { eq } from "drizzle-orm";
import { sendMagicLink, sendOrganizationInvitation } from "@opensesh/domain/server/mail";
import { run } from "@opensesh/domain/server/runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { mailLayerFromEnv } from "@/server/mail-layer";

export interface CapturedMagicLink {
  readonly token: string;
  readonly url: string;
}

export interface CapturedInvitation {
  readonly invitationId: string;
  readonly url: string;
}

export const makeAuth = (
  env: Cloudflare.Env,
  origin: string,
  capture?: (link: CapturedMagicLink) => void,
  captureInvitation?: (invitation: CapturedInvitation) => void,
) => buildAuth(env, origin, capture, captureInvitation);

const buildAuth = (
  env: Cloudflare.Env,
  origin: string,
  capture?: (link: CapturedMagicLink) => void,
  captureInvitation?: (invitation: CapturedInvitation) => void,
) => {
  const connectionString = env.HYPERDRIVE.connectionString;
  const database = makeDatabase(connectionString);
  const mailLive = mailLayerFromEnv(env);

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
        organizationHooks: {
          beforeCreateOrganization: async ({ organization: nextOrganization }) => ({
            data: {
              ...nextOrganization,
              id: `org_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
            },
          }),
          afterAcceptInvitation: async ({ invitation, member }) => {
            if (member.role !== "admin" && member.role !== "owner") return;
            const organizationEvents = await database
              .select({ id: events.id })
              .from(events)
              .where(eq(events.organizationId, invitation.organizationId));
            if (organizationEvents.length === 0) return;
            await database
              .insert(eventMembers)
              .values(
                organizationEvents.map((event) => ({
                  eventId: event.id,
                  userId: member.userId,
                  role: "admin" as const,
                })),
              )
              .onConflictDoNothing();
          },
        },
        sendInvitationEmail: async (data) => {
          const url = `${origin}/accept-invitation/${data.id}`;
          captureInvitation?.({ invitationId: data.id, url });
          const result = await run(
            sendOrganizationInvitation({
              organizationName: data.organization.name,
              inviterName: data.inviter.user.name,
              email: data.email,
              role: data.role,
              url,
            }),
            mailLive,
          );
          if (!result.ok) return await Promise.reject(new Error(result.error.message));
        },
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
