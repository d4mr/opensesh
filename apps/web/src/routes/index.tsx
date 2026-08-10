import { createFileRoute, redirect } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing";
import { getViewer } from "@/server-fns/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Shares the portal guard's cache key so the follow-up redirect is instant.
    const viewer = await context.queryClient.ensureQueryData({
      queryKey: ["portal-viewer"],
      queryFn: () => getViewer(),
      staleTime: 5 * 60_000,
    });
    if (viewer.ok) {
      if (viewer.data.roles.admin || viewer.data.roles.reviewer) {
        throw redirect({ to: "/admin" });
      }
      throw redirect({ to: "/portal" });
    }
    // Signed-out visitors get the marketing landing page.
  },
  component: LandingPage,
});
