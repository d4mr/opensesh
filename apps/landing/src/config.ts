// The product app. Landing lives at opensesh.io; the app at app.opensesh.io.
export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined) ?? "https://app.opensesh.io";

// Update once the contest repo is public.
export const GITHUB_URL = "https://github.com/deformercr/opensesh";

export const demoHref = (persona: "organizer" | "reviewer" | "speaker"): string =>
  `${APP_URL}/login?demo=${persona}`;
