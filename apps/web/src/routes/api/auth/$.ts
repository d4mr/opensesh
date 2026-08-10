import { createFileRoute } from "@tanstack/react-router";

import { makeAuth } from "@/lib/auth";

const handler = async (request: Request) => {
  const { env } = await import("cloudflare:workers");
  return await makeAuth(env, new URL(request.url).origin).handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
