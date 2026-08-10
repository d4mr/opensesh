import { DbError, Forbidden, getEventBySlug, run } from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { DemoPersonaRequest, MagicLinkRequest } from "@opensesh/domain/server/schema/auth";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Layer, Schema } from "effect";

import { makeAuth, type CapturedMagicLink } from "@/lib/auth";
import { runServer } from "@/server/runtime";

const EVENT_SLUG = "ai-engineer-nyc-2026";

const demoPersonas = {
  "demo@opensesh.io": { name: "Dana Organizer", target: "/admin" },
  "reviewer@opensesh.io": { name: "Rey Reviewer", target: "/admin" },
  "maya.chen@retrievallabs.ai": { name: "Maya Chen", target: "/portal" },
  "lina.haddad@checkpoint.health": { name: "Lina Haddad", target: "/portal" },
  "jamal.reed@agentdesk.co": { name: "Jamal Reed", target: "/portal" },
} as const;

export const requestMagicLink = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(MagicLinkRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    let captured: CapturedMagicLink | undefined;
    const auth = makeAuth(env, new URL(request.url).origin, (link) => {
      captured = link;
    });
    const program = Effect.tryPromise({
      try: () =>
        auth.api.signInMagicLink({
          body: { email: data.email, name: data.email, callbackURL: "/" },
          headers: request.headers,
        }),
      catch: (cause) => new DbError({ message: "Could not create magic link", cause }),
    }).pipe(
      Effect.map(() => ({
        demoLink: env.DEMO_MODE === "1" ? captured?.url : undefined,
      })),
    );

    return await run(program, Layer.empty);
  });

export const switchDemoPersona = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(DemoPersonaRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    if (env.DEMO_MODE !== "1") {
      return await run(
        Effect.fail(new Forbidden({ message: "Demo mode is disabled" })),
        Layer.empty,
      );
    }

    const request = getRequest();
    let captured: CapturedMagicLink | undefined;
    const auth = makeAuth(env, new URL(request.url).origin, (link) => {
      captured = link;
    });
    const persona = demoPersonas[data.email];
    const program = Effect.tryPromise({
      try: async () => {
        await auth.api.signInMagicLink({
          body: { email: data.email, name: persona.name },
          headers: request.headers,
        });
        if (captured === undefined) {
          return await Promise.reject(new Error("Magic link was not captured"));
        }
        await auth.api.magicLinkVerify({
          query: { token: captured.token },
          headers: request.headers,
        });
        return { target: persona.target };
      },
      catch: (cause) => new DbError({ message: "Could not switch demo persona", cause }),
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

export const getDemoMode = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  return env.DEMO_MODE === "1";
});
