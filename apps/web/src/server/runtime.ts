import { DbError, NeedsFirstEvent } from "@opensesh/domain";
import {
  type SessionIdentity,
  type CurrentUser,
  getCurrentUser,
  makeCurrentUserLive,
  requireCurrentUser,
  type RequiredRole,
} from "@opensesh/domain/server/current-user";
import { makeRepositoriesLive, type RepositoryServices } from "@opensesh/domain/server/repos";
import { type AppError, run } from "@opensesh/domain/server/runtime";
import { Mail } from "@opensesh/domain/server/mail";
import { getRequest } from "@tanstack/react-start/server";
import { ConfigProvider, Effect, Layer } from "effect";

import { makeAuth } from "@/lib/auth";
import { mailLayerFromEnv } from "@/server/mail-layer";

const DEMO_EVENT_SLUG = "ai-engineer-nyc-2026";
const EVALUATOR_EVENT_SLUG = "devflow-conf-2027";
const evaluatorEmails = new Set([
  "jordan.organizer@sbek-test.example.com",
  "priya.speaker@sbek-test.example.com",
  "marcus.speaker@sbek-test.example.com",
  "sam.reviewer@sbek-test.example.com",
]);
const demoEmails = new Set([
  "demo@opensesh.io",
  "reviewer@opensesh.io",
  "maya.chen@retrievallabs.ai",
  "lina.haddad@checkpoint.health",
  "jamal.reed@agentdesk.co",
]);
const preferredEventSlugForSession = (session: SessionIdentity) =>
  evaluatorEmails.has(session.email)
    ? EVALUATOR_EVENT_SLUG
    : demoEmails.has(session.email)
      ? DEMO_EVENT_SLUG
      : undefined;

const sessionIdentity = (headers: Headers, origin: string) =>
  Effect.gen(function* () {
    const { env } = yield* Effect.promise(() => import("cloudflare:workers"));
    const auth = makeAuth(env, origin);
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: (cause) => new DbError({ message: "Could not load session", cause }),
    });
    return session === null
      ? null
      : {
          userId: session.user.id,
          email: session.user.email,
          ...(session.session.activeOrganizationId === null
            ? {}
            : { activeOrganizationId: session.session.activeOrganizationId }),
        };
  });

export const runSessionServer = async <A, E extends AppError>(
  program: (session: SessionIdentity, eventSlug: string) => Effect.Effect<A, E, RepositoryServices>,
) => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const loadSession = sessionIdentity(request.headers, new URL(request.url).origin);
  const connectionString = env.HYPERDRIVE.connectionString;
  const currentUserLive = makeCurrentUserLive(
    connectionString,
    loadSession,
    preferredEventSlugForSession,
  );
  const secured = Effect.gen(function* () {
    const user = yield* getCurrentUser;
    if (user.eventSlug === null) {
      return yield* Effect.fail(
        new NeedsFirstEvent({ message: "Create your first event to continue" }),
      );
    }
    return yield* program(
      {
        userId: user.userId,
        email: user.email,
        activeOrganizationId: user.orgId,
      },
      user.eventSlug,
    );
  });
  return await run(secured, Layer.merge(makeRepositoriesLive(connectionString), currentUserLive));
};

export const runServer = async <A, E extends AppError>(
  program: Effect.Effect<A, E, RepositoryServices | CurrentUser | Mail>,
  options?: { readonly require?: RequiredRole },
) => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const loadSession = sessionIdentity(request.headers, new URL(request.url).origin);
  const connectionString = env.HYPERDRIVE.connectionString;
  const currentUserLive = makeCurrentUserLive(
    connectionString,
    loadSession,
    preferredEventSlugForSession,
  );
  const mailLive = mailLayerFromEnv(env);
  const services = Layer.mergeAll(
    makeRepositoriesLive(connectionString),
    currentUserLive,
    mailLive,
    ConfigProvider.layer(
      ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }),
    ),
  );
  const secured =
    options?.require === undefined
      ? program
      : requireCurrentUser(options.require).pipe(Effect.andThen(program));

  return await run(secured, services);
};
