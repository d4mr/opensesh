import { createFileRoute } from "@tanstack/react-router";

import { makeAuth } from "@/lib/auth";

const handler = async (request: Request) => {
  const { env } = await import("cloudflare:workers");
  const url = new URL(request.url);
  // Every MCP authorization goes through the consent screen: the plugin only
  // routes to the consent page when the client asks with prompt=consent, and
  // MCP clients typically don't — so the boundary asks on their behalf. A
  // token must never be minted behind a signed-in user's back.
  if (url.pathname.endsWith("/api/auth/mcp/authorize") && !url.searchParams.has("prompt")) {
    url.searchParams.set("prompt", "consent");
    request = new Request(url, request);
  }
  return await makeAuth(env, url.origin).handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
