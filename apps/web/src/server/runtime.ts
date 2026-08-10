import { DbError, Unauthenticated } from "@opensesh/domain";
import {
  type SessionIdentity,
  type CurrentUser,
  makeCurrentUserLive,
  requireCurrentUser,
  type RequiredRole,
} from "@opensesh/domain/server/current-user";
import { makeRepositoriesLive, type RepositoryServices } from "@opensesh/domain/server/repos";
import { type AppError, run } from "@opensesh/domain/server/runtime";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Layer } from "effect";

import { makeAuth } from "@/lib/auth";

const EVENT_SLUG = "ai-engineer-nyc-2026";

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
  const secured = Effect.gen(function* () {
    const session = yield* loadSession;
    if (session === null) {
      return yield* Effect.fail(new Unauthenticated({ message: "Sign in to continue" }));
    }
    return yield* program(session, EVENT_SLUG);
  });
  return await run(secured, makeRepositoriesLive(env.HYPERDRIVE.connectionString));
};

export const runServer = async <A, E extends AppError>(
  program: Effect.Effect<A, E, RepositoryServices | CurrentUser>,
  options?: { readonly require?: RequiredRole },
) => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const loadSession = sessionIdentity(request.headers, new URL(request.url).origin);
  const connectionString = env.HYPERDRIVE.connectionString;
  const currentUserLive = makeCurrentUserLive(connectionString, loadSession, EVENT_SLUG);
  const services = Layer.merge(makeRepositoriesLive(connectionString), currentUserLive);
  const secured =
    options?.require === undefined
      ? program
      : requireCurrentUser(options.require).pipe(Effect.andThen(program));

  return await run(secured, services);
};
