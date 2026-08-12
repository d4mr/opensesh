// Emits the OpenAPI document straight from the endpoint definitions — no
// running server needed — and refreshes the docs app's committed snapshot.
// Usage: pnpm exec tsx scripts/emit-openapi.mjs
// After running, regenerate the MDX pages: pnpm --filter @opensesh/docs generate:api
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apiEndpoints } from "../src/server/api/index.ts";
import { buildOpenApiDocument } from "../src/server/api/openapi.ts";

// The committed snapshot must always point at production.
const document = buildOpenApiDocument(apiEndpoints, "https://app.opensesh.io");
const target = join(dirname(fileURLToPath(import.meta.url)), "../../docs/openapi.json");
await writeFile(target, `${JSON.stringify(document, null, 1)}\n`);
console.log(`wrote ${target}`);
