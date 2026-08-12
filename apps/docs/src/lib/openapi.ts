import { createOpenAPI } from "fumadocs-openapi/server";

// The committed snapshot of the app's OpenAPI 3.1 document
// (GET https://app.opensesh.io/api/v1/openapi.json). Refresh with
// `pnpm generate:api` whenever the API surface changes.
export const openapi = createOpenAPI({
  input: ["./openapi.json"],
});
