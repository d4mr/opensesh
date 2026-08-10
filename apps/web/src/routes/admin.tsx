import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/app/admin-shell";
import { getStaffViewer } from "@/server-fns/auth";
import { getAdminBootstrap } from "@/server-fns/admin";

const staffViewerQuery = queryOptions({
  queryKey: ["staff-viewer"],
  queryFn: () => getStaffViewer(),
  staleTime: 5 * 60_000,
});

const adminEventsQuery = queryOptions({
  queryKey: ["admin-events"],
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData(staffViewerQuery);
    if (!viewer.ok) {
      throw redirect({ to: viewer.error.status === 401 ? "/login" : "/portal" });
    }
    return { user: viewer.data };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminEventsQuery),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bootstrap = useSuspenseQuery(adminEventsQuery);

  useEffect(() => {
    setSelectedId(window.localStorage.getItem("opensesh-event-id"));
  }, []);

  if (!bootstrap.data.ok) return <p className="p-6">{bootstrap.data.error.message}</p>;
  const event =
    bootstrap.data.data.find((item) => item.id === selectedId) ?? bootstrap.data.data[0];
  if (event === undefined) return <p className="p-6">No event is available.</p>;

  const selectEvent = (eventId: string) => {
    window.localStorage.setItem("opensesh-event-id", eventId);
    setSelectedId(eventId);
  };

  return (
    <AdminShell
      event={event}
      events={bootstrap.data.data}
      user={user}
      selectEvent={selectEvent}
      eventCreated={async (eventId) => {
        await bootstrap.refetch();
        selectEvent(eventId);
      }}
    />
  );
}
