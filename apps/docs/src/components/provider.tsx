"use client";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/waku";

export function Provider({ children }: { children: ReactNode }) {
  return (
    // Static deploy: the search dialog fetches the prebuilt Orama index
    // from /api/search and runs queries client-side.
    <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
  );
}
