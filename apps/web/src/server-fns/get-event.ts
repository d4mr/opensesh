import { createServerFn } from "@tanstack/react-start";

export const getEvent = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  const { getEventBySlug } = await import("@opensesh/domain/server/events");
  const { makeEventsLive } = await import("@opensesh/domain/server/repos");
  const { run } = await import("@opensesh/domain/server/runtime");

  return await run(
    getEventBySlug("ai-engineer-nyc-2026"),
    makeEventsLive(env.HYPERDRIVE.connectionString),
  );
});
