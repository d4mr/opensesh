import { createServerFn } from "@tanstack/react-start";

export const getEvent = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  const { getEventBySlug, makeDbLive, run } = await import("@opensesh/domain");

  return await run(getEventBySlug("ai-engineer-nyc-2026"), makeDbLive(env.DB));
});
