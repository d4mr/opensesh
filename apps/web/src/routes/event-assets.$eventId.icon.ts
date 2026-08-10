import { Events } from "@opensesh/domain/server/repos";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { runServer } from "@/server/runtime";

export const Route = createFileRoute("/event-assets/$eventId/icon")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { env } = await import("cloudflare:workers");
        const result = await runServer(
          Effect.gen(function* () {
            const events = yield* Events;
            return yield* events.get(params.eventId);
          }),
        );
        if (!result.ok) return new Response(result.error.message, { status: result.error.status });
        if (result.data.logoKey === null) return new Response("Icon not found", { status: 404 });
        const object = await env.FILES.get(result.data.logoKey);
        if (object === null) return new Response("Icon not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("cache-control", "public, max-age=3600");
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      },
    },
  },
});
