import { DbError } from "@opensesh/domain";
import {
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

export const runServer = async <A, E extends AppError>(
  program: Effect.Effect<A, E, RepositoryServices | CurrentUser>,
  options?: { readonly require?: RequiredRole },
) => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const auth = makeAuth(env, new URL(request.url).origin);
  const loadSession = Effect.tryPromise({
    try: () => auth.api.getSession({ headers: request.headers }),
    catch: (cause) => new DbError({ message: "Could not load session", cause }),
  }).pipe(
    Effect.map((session) =>
      session === null ? null : { userId: session.user.id, email: session.user.email },
    ),
  );
  const currentUserLive = makeCurrentUserLive(env.DB, loadSession, EVENT_SLUG);
  const services = Layer.merge(makeRepositoriesLive(env.DB), currentUserLive);
  const secured =
    options?.require === undefined
      ? program
      : requireCurrentUser(options.require).pipe(Effect.andThen(program));

  return await run(secured, services);
};
