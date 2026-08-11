import { DurableObject } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";

// Documents must revalidate on every load: without this, browsers
// heuristically cache the HTML shell and keep referencing deleted asset
// hashes after a deploy. Hashed assets keep their immutable caching.
const serve = async (request: Request) => {
  const response = await handler.fetch(request);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html") && !response.headers.has("cache-control")) {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-cache");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
};

// The database lives in AWS us-east-1 and Workers have no region pinning,
// so by default the app renders wherever the visitor is and pays a
// cross-region round trip per query phase (~250ms measured from Asia).
// Durable Objects do honor a location hint: every real request executes
// inside a per-session object pinned near the database, which turns each
// query phase into a low-millisecond hop and leaves exactly one
// user-to-region hop per request regardless of visitor geography.
export class AppRunner extends DurableObject<Cloudflare.Env> {
  override async fetch(request: Request) {
    return serve(request);
  }
}

const sessionShard = (request: Request) =>
  /opensesh\.session_token=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1] ??
  request.headers.get("cf-connecting-ip") ??
  "anonymous";

export default {
  async fetch(request, env) {
    const stub = env.APP_RUNNER.get(env.APP_RUNNER.idFromName(sessionShard(request)), {
      locationHint: "enam",
    });
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
