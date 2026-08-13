import { DbError } from "@opensesh/domain";
import { DEMO_PASSWORD, DEMO_PERSONAS } from "@opensesh/domain/demo";
import { oauthApplications } from "@opensesh/domain/db/auth";
import { getEventBySlug } from "@opensesh/domain/server/events";
import { makeDatabase } from "@opensesh/domain/server/db";
import { run } from "@opensesh/domain/server/runtime";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { DemoPersonaRequest, MagicLinkRequest } from "@opensesh/domain/server/schema/auth";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";

import { makeAuth } from "@/lib/auth";
import { runServer } from "@/server/runtime";

const EVENT_SLUG = "ai-engineer-nyc-2026";

export const requestMagicLink = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(MagicLinkRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    const auth = makeAuth(env, new URL(request.url).origin);
    const program = Effect.tryPromise({
      try: () =>
        auth.api.signInMagicLink({
          body: {
            email: data.email,
            name: data.name?.trim() || data.email,
            callbackURL: data.callbackUrl ?? "/",
          },
          headers: request.headers,
        }),
      catch: (cause) => new DbError({ message: "Could not create magic link", cause }),
    }).pipe(Effect.asVoid);

    return await run(program, Layer.empty);
  });

// One-click sign-in, but only into the sandbox: the request schema admits
// exactly the demo-workspace personas, whose credentials are public by design.
export const switchDemoPersona = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(DemoPersonaRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    const auth = makeAuth(env, new URL(request.url).origin);
    const persona = DEMO_PERSONAS.find((candidate) => candidate.email === data.email);
    const program = Effect.tryPromise({
      try: async () => {
        await auth.api.signInEmail({
          body: { email: data.email, password: DEMO_PASSWORD },
          headers: request.headers,
        });
        return { target: persona?.target ?? "/" };
      },
      catch: (cause) =>
        new DbError({
          message: `Could not switch demo persona: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        }),
    });

    return await run(program, Layer.empty);
  });

// Name and icon of a registered OAuth client, for the consent screen. Client
// metadata is self-declared at registration (open DCR), so it identifies the
// request without vouching for it — the consent copy stays factual.
const OauthClientRequest = Schema.Struct({ clientId: Schema.String });

export const getOauthClient = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(OauthClientRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const database = makeDatabase(env.HYPERDRIVE.connectionString);
    const program = Effect.tryPromise({
      try: async () => {
        const [client] = await database
          .select({ name: oauthApplications.name, icon: oauthApplications.icon })
          .from(oauthApplications)
          .where(eq(oauthApplications.clientId, data.clientId))
          .limit(1);
        return client ?? null;
      },
      catch: (cause) => new DbError({ message: "Could not load the requesting app", cause }),
    });
    return await run(program, Layer.empty);
  });

export const getViewer = createServerFn({ method: "GET" }).handler(async () =>
  runServer(getCurrentUser, { require: "session" }),
);

export const getStaffViewer = createServerFn({ method: "GET" }).handler(async () =>
  runServer(getCurrentUser, { require: "staff" }),
);

export const getAdminViewer = createServerFn({ method: "GET" }).handler(async () =>
  runServer(getCurrentUser, { require: "admin" }),
);

export const getPublicEvent = createServerFn({ method: "GET" }).handler(async () =>
  runServer(getEventBySlug(EVENT_SLUG)),
);
