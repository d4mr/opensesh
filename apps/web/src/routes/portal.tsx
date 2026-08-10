import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { PortalShell } from "@/components/app/portal-shell";
import { getViewer } from "@/server-fns/auth";
import { getEvent } from "@/server-fns/get-event";

export const Route = createFileRoute("/portal")({
  beforeLoad: async ({ context }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData({
      queryKey: ["portal-viewer"],
      queryFn: () => getViewer(),
      staleTime: 5 * 60_000,
    });
    if (!viewer.ok) {
      throw redirect({ to: "/login" });
    }
    return { user: viewer.data };
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { user } = Route.useRouteContext();
  const event = useQuery({
    queryKey: ["event", "ai-engineer-nyc-2026"],
    queryFn: () => getEvent(),
  });

  if (event.data === undefined) return null;
  if (!event.data.ok) return <p className="p-6">{event.data.error.message}</p>;

  return <PortalShell eventName={event.data.data.name} user={user} />;
}
