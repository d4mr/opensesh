import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/org-assets/$orgId/icon")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { env } = await import("cloudflare:workers");
        const object = await env.FILES.get(`organizations/${params.orgId}/icon`);
        if (object === null) return new Response("Logo not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("cache-control", "public, max-age=3600");
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      },
    },
  },
});
