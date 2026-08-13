import { makeDatabase } from "@opensesh/domain/server/db";
import {
  accounts,
  oauthAccessTokens,
  oauthApplications,
  oauthConsents,
  organizationInvitations,
  organizationMembers,
  organizations,
  sessions,
  users,
  verifications,
} from "@opensesh/domain/db/auth";
import { sendMagicLink, sendOrganizationInvitation } from "@opensesh/domain/server/mail";
import { run } from "@opensesh/domain/server/runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, mcp, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { portalAccess } from "@/lib/portal-access-plugin";
import { mailLayerFromEnv } from "@/server/mail-layer";

export const makeAuth = (env: Cloudflare.Env, origin: string) => {
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
        oauthApplication: oauthApplications,
        oauthAccessToken: oauthAccessTokens,
        oauthConsent: oauthConsents,
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
        sendMagicLink: async ({ email, url }) => {
          const result = await run(sendMagicLink({ email, url }), mailLive);
          if (!result.ok) {
            return await Promise.reject(new Error(result.error.message));
          }
          if (result.data.status === "failed") {
            return await Promise.reject(
              new Error(result.data.error ?? "Could not send the sign-in email"),
            );
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
        },
        sendInvitationEmail: async (data) => {
          const url = `${origin}/accept-invitation/${data.id}`;
          const result = await run(
            sendOrganizationInvitation({
              organizationId: data.organization.id,
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
      // Turns the app into an OAuth 2.1 authorization server for MCP
      // clients: dynamic client registration, PKCE, and a consent screen.
      // Unauthenticated authorize requests are sent to the login page and
      // resume after sign-in. The auth route boundary injects prompt=consent
      // into every authorize request, so this consent page is always shown —
      // never a silent code issue.
      mcp({
        loginPage: "/login",
        oidcConfig: { loginPage: "/login", consentPage: "/oauth/consent" },
      }),
      portalAccess(),
      tanstackStartCookies(),
    ],
  });
};
