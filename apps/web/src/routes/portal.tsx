import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { PortalShell } from "@/components/app/portal-shell";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { getViewer } from "@/server-fns/auth";
import { getEvent } from "@/server-fns/get-event";

const portalViewerQuery = queryOptions({
  queryKey: ["portal-viewer"],
  queryFn: () => getViewer(),
  staleTime: 5 * 60_000,
});

const portalEventQuery = queryOptions({
  queryKey: ["event", "ai-engineer-nyc-2026"],
  queryFn: () => getEvent(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/portal")({
  beforeLoad: async ({ context }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData(portalViewerQuery);
    if (!viewer.ok) {
      throw redirect({ to: "/login" });
    }
    return { user: viewer.data };
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(portalEventQuery),
      context.queryClient.ensureQueryData(speakerPortalQuery),
    ]).then(([event]) => event),
  component: PortalLayout,
});

function PortalLayout() {
  const { user } = Route.useRouteContext();
  const event = useSuspenseQuery(portalEventQuery);

  if (!event.data.ok) return <p className="p-6">{event.data.error.message}</p>;

  return <PortalShell event={event.data.data} user={user} />;
}
