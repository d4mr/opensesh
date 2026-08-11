import { DbError, NeedsFirstEvent } from "@opensesh/domain";
import {
  type SessionIdentity,
  type CurrentUser,
  getCurrentUser,
  makeCurrentUserLiveWith,
  requireCurrentUser,
  type RequiredRole,
} from "@opensesh/domain/server/current-user";
import { Db, makeDatabase } from "@opensesh/domain/server/db";
import { makeRepositoriesLiveWith, type RepositoryServices } from "@opensesh/domain/server/repos";
import { type AppError, type ServerResult, toServerResult } from "@opensesh/domain/server/runtime";
import { Mail } from "@opensesh/domain/server/mail";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { ConfigProvider, Effect, Layer, ManagedRuntime } from "effect";

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

type AppServices = RepositoryServices | CurrentUser | Mail;
type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;

// One runtime — one Postgres client, one auth-session load, one cached
// membership lookup — per Worker request. Server functions invoked during a
// single SSR pass all resolve the same Request from async context, so they
// share it; a fresh request gets a fresh entry, which keeps Workers'
// per-request I/O isolation intact. Building a runtime per server-function
// call instead cost two extra connection setups (~230ms RTT each to the
// database region) on every call — the dominant term in page latency.
const runtimes = new WeakMap<Request, AppRuntime>();

const requestRuntime = async (): Promise<AppRuntime> => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const cached = runtimes.get(request);
  if (cached !== undefined) return cached;
  const loadSession = sessionIdentity(request.headers, new URL(request.url).origin);
  const dbLive = Layer.succeed(Db, { database: makeDatabase(env.HYPERDRIVE.connectionString) });
  const services = Layer.mergeAll(
    makeRepositoriesLiveWith(dbLive),
    makeCurrentUserLiveWith(dbLive, loadSession, preferredEventSlugForSession),
    mailLayerFromEnv(env),
    ConfigProvider.layer(
      ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }),
    ),
  );
  const runtime = ManagedRuntime.make(services);
  runtimes.set(request, runtime);
  return runtime;
};

// Reflect typed failures in the HTTP status — but only on the /_serverFn RPC
// path. During SSR these same handlers run in-process and share the document's
// h3 event, and loaders deliberately read 401/428 from the ENVELOPE as
// redirect signals; stamping the document response would break those pages.
const withStatus = <A>(result: ServerResult<A>): ServerResult<A> => {
  if (!result.ok && new URL(getRequest().url).pathname.startsWith("/_serverFn")) {
    setResponseStatus(result.error.status);
  }
  return result;
};

export const runSessionServer = async <A, E extends AppError>(
  program: (session: SessionIdentity, eventSlug: string) => Effect.Effect<A, E, RepositoryServices>,
) => {
  const runtime = await requestRuntime();
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
  return withStatus(await runtime.runPromise(toServerResult(secured)));
};

export const runServer = async <A, E extends AppError>(
  program: Effect.Effect<A, E, RepositoryServices | CurrentUser | Mail>,
  options?: { readonly require?: RequiredRole },
) => {
  const runtime = await requestRuntime();
  const secured =
    options?.require === undefined
      ? program
      : requireCurrentUser(options.require).pipe(Effect.andThen(program));

  return withStatus(await runtime.runPromise(toServerResult(secured)));
};
