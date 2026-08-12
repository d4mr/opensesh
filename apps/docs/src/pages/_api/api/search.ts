import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// staticGET exports the whole Orama index as JSON at build time; the
// client (see provider.tsx) downloads it and searches locally — no
// server needed on the static deployment.
export const { staticGET: GET } = createFromSource(source);

export async function getConfig() {
  return {
    render: "static" as const,
  } as const;
}
