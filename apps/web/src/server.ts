import handler from "@tanstack/react-start/server-entry";

// Documents must revalidate on every load: without this, browsers
// heuristically cache the HTML shell and keep referencing deleted asset
// hashes after a deploy. Hashed assets keep their immutable caching.
export default {
  async fetch(request) {
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
  },
} satisfies ExportedHandler<Cloudflare.Env>;
