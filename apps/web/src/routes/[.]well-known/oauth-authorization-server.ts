import { createFileRoute } from "@tanstack/react-router";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";

import { makeAuth } from "@/lib/auth";

// OAuth 2.1 authorization-server metadata (RFC 8414). MCP clients read this
// to find the authorize, token, and dynamic-client-registration endpoints
// that the better-auth mcp plugin serves under /api/auth.
const handler = async (request: Request) => {
  const { env } = await import("cloudflare:workers");
  return await oAuthDiscoveryMetadata(makeAuth(env, new URL(request.url).origin))(request);
};

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
    },
  },
});
