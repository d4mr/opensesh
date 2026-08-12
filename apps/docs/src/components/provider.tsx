"use client";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/waku";

// Base UI's exit lifecycle waits on element.getAnimations() promises that
// never settle under this React/Waku pairing, so a deactivated tab panel is
// never unmounted and stacks below the active one. This official escape
// hatch (checked in Base UI's useAnimationsFinished) makes open/close
// completion synchronous — the docs use no exit animations, so nothing is
// lost visually.
if (typeof globalThis !== "undefined") {
  (globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true;
}

export function Provider({ children }: { children: ReactNode }) {
  return (
    // Static deploy: the search dialog fetches the prebuilt Orama index
    // from /api/search and runs queries client-side.
    <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
  );
}
