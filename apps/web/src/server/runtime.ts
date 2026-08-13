import { DbError, NeedsFirstEvent } from "@opensesh/domain";
import { DEMO_EVENT_SLUG, DEMO_PERSONA_EMAILS } from "@opensesh/domain/demo";
import {
  type SessionIdentity,
  type CurrentUser,
  getCurrentUser,
  makeCurrentUserLiveWith,
  requireCurrentUser,
  type RequiredRole,
} from "@opensesh/domain/server/current-user";
import { Db, makeDatabase } from "@opensesh/domain/server/db";
import {
  makeRepositoriesLiveWith,
  type RepositoryServices,
  SpeakerComms,
} from "@opensesh/domain/server/repos";
import { type AppError, type ServerResult, toServerResult } from "@opensesh/domain/server/runtime";
import { Mail } from "@opensesh/domain/server/mail";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { ConfigProvider, Effect, Layer, ManagedRuntime } from "effect";

import { makeAuth } from "@/lib/auth";
import { mailLayerFromEnv } from "@/server/mail-layer";
import {
  consumeMailBatch,
  enqueueMailLogIds,
  MailQueue,
  type MailQueueMessage,
  makeMailQueueLive,
} from "@/server/mail-queue";

const demoEmails = new Set<string>(DEMO_PERSONA_EMAILS);
const preferredEventSlugForSession = (session: SessionIdentity) =>
  demoEmails.has(session.email) ? DEMO_EVENT_SLUG : undefined;

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
          name: session.user.name,
          ...(session.session.activeOrganizationId === null
            ? {}
            : { activeOrganizationId: session.session.activeOrganizationId }),
        };
  });

type AppServices = RepositoryServices | CurrentUser | Mail | MailQueue;
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
    makeMailQueueLive(env.MAIL_QUEUE),
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
        name: user.name,
        activeOrganizationId: user.orgId,
      },
      user.eventSlug,
    );
  });
  return withStatus(await runtime.runPromise(toServerResult(secured)));
};

export const runServer = async <A, E extends AppError>(
  program: Effect.Effect<A, E, RepositoryServices | CurrentUser | Mail | MailQueue>,
  options?: { readonly require?: RequiredRole },
) => {
  const runtime = await requestRuntime();
  const secured =
    options?.require === undefined
      ? program
      : requireCurrentUser(options.require).pipe(Effect.andThen(program));

  return withStatus(await runtime.runPromise(toServerResult(secured)));
};

// The 15-minute sandbox reset: reseed the demo workspace and delete the R2
// objects its wiped uploads referenced. Seed-owned assets survive (the seed
// module filters them), and identity rows stay so live demo sessions persist.
export const runDemoReset = async (env: Cloudflare.Env) => {
  const { resetDemoOrg } = await import("@opensesh/domain/seed");
  const database = makeDatabase(env.HYPERDRIVE.connectionString);
  try {
    const storageKeys = await resetDemoOrg(database);
    if (storageKeys.length > 0) {
      await env.FILES.delete([...storageKeys]);
    }
    return { orphanedObjects: storageKeys.length };
  } finally {
    await database.$client.end();
  }
};

export const runScheduledTaskReminders = async (env: Cloudflare.Env, now: Date) => {
  const dbLive = Layer.succeed(Db, { database: makeDatabase(env.HYPERDRIVE.connectionString) });
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      makeRepositoriesLiveWith(dbLive),
      mailLayerFromEnv(env),
      makeMailQueueLive(env.MAIL_QUEUE),
      ConfigProvider.layer(
        ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }),
      ),
    ),
  );
  try {
    const result = await runtime.runPromise(
      toServerResult(
        Effect.gen(function* () {
          const communications = yield* SpeakerComms;
          const rules = yield* communications.listEnabledReminderRules();
          const deliveries = yield* Effect.forEach(
            rules,
            (rule) =>
              Effect.gen(function* () {
                const queued = yield* communications.queueReminderRule(
                  rule.eventId,
                  rule.id,
                  env.APP_ORIGIN,
                  now,
                );
                return {
                  skipped: queued.skippedAsDuplicate,
                  queued: queued.logIds.length,
                  logIds: queued.logIds,
                };
              }),
            { concurrency: 3 },
          );
          let skipped = 0;
          let queued = 0;
          for (const delivery of deliveries) {
            if (delivery.skipped) skipped += 1;
            queued += delivery.queued;
          }
          const mailQueue = yield* MailQueue;
          yield* mailQueue.enqueue(deliveries.flatMap((delivery) => delivery.logIds));
          return { rules: deliveries.length, skipped, queued };
        }),
      ),
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  } finally {
    await runtime.dispose();
  }
};

export const runMailSweep = async (env: Cloudflare.Env, now: Date) => {
  const runtime = ManagedRuntime.make(mailLayerFromEnv(env));
  try {
    const result = await runtime.runPromise(
      toServerResult(
        Effect.gen(function* () {
          const mail = yield* Mail;
          const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
          const logIds = yield* mail.sweepStale(staleBefore);
          const enqueued = yield* Effect.promise(() => enqueueMailLogIds(env.MAIL_QUEUE, logIds));
          return { stale: logIds.length, ...enqueued };
        }),
      ),
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  } finally {
    await runtime.dispose();
  }
};

export const runMailQueueBatch = async (
  env: Cloudflare.Env,
  batch: MessageBatch<MailQueueMessage>,
) => {
  const runtime = ManagedRuntime.make(mailLayerFromEnv(env));
  try {
    await consumeMailBatch(batch, async ({ logId }, attempts) => {
      const outcome = await runtime.runPromise(
        Effect.result(
          Effect.gen(function* () {
            const mail = yield* Mail;
            const delivery = yield* mail.sendQueued(logId);
            if (delivery.status === "queued" && attempts > 5) {
              yield* mail.failQueued(logId, delivery.error ?? "Delivery retries exhausted");
              return { kind: "permanent" } as const;
            }
            if (delivery.status === "queued") return { kind: "transient" } as const;
            if (delivery.status === "skipped") return { kind: "skipped" } as const;
            if (delivery.status === "failed") return { kind: "permanent" } as const;
            return { kind: "delivered" } as const;
          }),
        ),
      );
      if (outcome._tag === "Success") return outcome.success;
      const released = await runtime.runPromise(
        Effect.result(
          Effect.gen(function* () {
            const mail = yield* Mail;
            if (attempts > 5) {
              yield* mail.failQueued(logId, "Delivery retries exhausted");
            } else {
              yield* mail.releaseQueued(logId);
            }
          }),
        ),
      );
      if (released._tag === "Failure") {
        console.error(JSON.stringify({ event: "mail_release_failed", logId, attempts }));
      }
      return attempts > 5 ? { kind: "permanent" } : { kind: "transient" };
    });
  } finally {
    await runtime.dispose();
  }
};
