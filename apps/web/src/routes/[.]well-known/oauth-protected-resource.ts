import { createFileRoute } from "@tanstack/react-router";
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";

import { makeAuth } from "@/lib/auth";

// Protected-resource metadata (RFC 9728): tells MCP clients which
// authorization server protects /api/mcp, completing the discovery chain
// that starts from the 401 challenge.
const handler = async (request: Request) => {
  const { env } = await import("cloudflare:workers");
  return await oAuthProtectedResourceMetadata(makeAuth(env, new URL(request.url).origin))(request);
};

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
    },
  },
});
