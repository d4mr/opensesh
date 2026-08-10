import { createServerFn } from "@tanstack/react-start"

export const getEvent = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getEventBySlug }, { run }] = await Promise.all([
    import("@/server/events"),
    import("@/server/runtime"),
  ])

  return await run(getEventBySlug("ai-engineer-nyc-2026"))
})
