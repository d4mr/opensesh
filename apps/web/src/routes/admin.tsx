import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AdminShell } from "@/components/app/admin-shell";
import { getStaffViewer } from "@/server-fns/auth";
import { getAdminBootstrap } from "@/server-fns/admin";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData({
      queryKey: ["staff-viewer"],
      queryFn: () => getStaffViewer(),
      staleTime: 5 * 60_000,
    });
    if (!viewer.ok) {
      throw redirect({ to: viewer.error.status === 401 ? "/login" : "/portal" });
    }
    return { user: viewer.data };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const [selectedId, setSelectedId] = useState(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("opensesh-event-id"),
  );
  const bootstrap = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => getAdminBootstrap(),
  });

  if (bootstrap.data === undefined) return null;
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
