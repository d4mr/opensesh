import { createFileRoute } from "@tanstack/react-router";

import { apiEndpoints } from "@/server/api";
import { dispatchApiRequest, jsonResponse } from "@/server/api/dispatch";
import { buildOpenApiDocument } from "@/server/api/openapi";

// The whole REST API hangs off this catch-all: /api/v1/<anything>. The
// dispatcher owns matching, auth, validation, and the error envelope; this
// file only peels the sub-path and handles the two unauthenticated meta
// endpoints (the index and the OpenAPI document).
const handle = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/v1/, "") || "/";
  if (request.method === "GET" && (subPath === "/" || subPath === "")) {
    return jsonResponse({
      name: "opensesh API",
      version: "v1",
      documentation: "https://docs.opensesh.io/api",
      openapi: `${url.origin}/api/v1/openapi.json`,
      authentication:
        "Authorization: Bearer osk_… — create keys in Organization settings → API keys",
      endpoints: apiEndpoints.length,
    });
  }
  if (request.method === "GET" && subPath === "/openapi.json") {
    return jsonResponse(buildOpenApiDocument(apiEndpoints, url.origin), 200, {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    });
  }
  return dispatchApiRequest(apiEndpoints, request, subPath);
};

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
    },
  },
});
