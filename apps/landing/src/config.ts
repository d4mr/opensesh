// The product app. Landing lives at opensesh.io; the app at app.opensesh.io.
// In local dev the app runs on port 3000 (`pnpm dev`).
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "https://app.opensesh.io");

// Update once the contest repo is public.
export const GITHUB_URL = "https://github.com/deformercr/opensesh";

export const DOCS_URL = "https://docs.opensesh.io";

export const demoHref = (persona: "organizer" | "reviewer" | "speaker"): string =>
  `${APP_URL}/login?demo=${persona}`;
