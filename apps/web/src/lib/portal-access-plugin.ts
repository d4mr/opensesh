import {
  parsePortalAccessGrant,
  portalAccessIdentifier,
} from "@opensesh/domain/server/portal-access";
import { createAuthEndpoint, getSessionFromCtx, originCheck } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import * as z from "zod";

import { PORTAL_EVENT_COOKIE } from "@/lib/portal-event";

// Speaker emails carry /portal/access/<token> links; this endpoint exchanges
// one for a session. It mirrors the magic-link verify endpoint's wiring
// (verification storage, user find-or-create, session + cookie) with two
// deliberate differences: tokens are long-lived and multi-use — an emailed
// link must keep working when the speaker returns to it weeks later — and a
// successful exchange pins the portal to the contact's event via cookie.
export const portalAccess = () =>
  ({
    id: "portal-access",
    endpoints: {
      portalAccessVerify: createAuthEndpoint(
        "/portal-access/verify",
        {
          method: "GET",
          query: z.object({
            token: z.string(),
            callbackURL: z.string().optional(),
          }),
          use: [
            originCheck((ctx) =>
              ctx.query.callbackURL ? decodeURIComponent(ctx.query.callbackURL) : "/portal",
            ),
          ],
          requireHeaders: true,
        },
        async (ctx) => {
          const origin = new URL(ctx.context.baseURL).origin;
          const requested = ctx.query.callbackURL
            ? decodeURIComponent(ctx.query.callbackURL)
            : "/portal";
          // Tokens only ever grant portal entry — never an arbitrary redirect.
          const destination = requested.startsWith("/portal") ? requested : "/portal";
          const expiredRedirect = () =>
            ctx.redirect(new URL("/login?error=portal-link", origin).toString());
          const identifier = await portalAccessIdentifier(ctx.query.token);
          const verification = await ctx.context.internalAdapter.findVerificationValue(identifier);
          if (verification === null || verification.expiresAt < new Date()) {
            throw expiredRedirect();
          }
          const grant = parsePortalAccessGrant(verification.value);
          if (grant === null) throw expiredRedirect();

          const session = await getSessionFromCtx(ctx);
          if (session === null || session.user.email !== grant.email) {
            let user = await ctx.context.internalAdapter
              .findUserByEmail(grant.email)
              .then((result) => result?.user);
            if (!user) {
              user = await ctx.context.internalAdapter.createUser({
                email: grant.email,
                emailVerified: true,
                name: grant.name,
              });
            }
            if (!user) throw expiredRedirect();
            if (!user.emailVerified) {
              user = await ctx.context.internalAdapter.updateUser(user.id, {
                emailVerified: true,
              });
            }
            const created = await ctx.context.internalAdapter.createSession(user.id);
            if (!created) throw expiredRedirect();
            await setSessionCookie(ctx, { session: created, user });
          }
          ctx.setCookie(PORTAL_EVENT_COOKIE, encodeURIComponent(grant.eventSlug), {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          });
          throw ctx.redirect(new URL(destination, origin).toString());
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
