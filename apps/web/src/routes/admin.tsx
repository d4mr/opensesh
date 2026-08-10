import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminShell } from "@/components/app/admin-shell";
import { getStaffViewer } from "@/server-fns/auth";
import { getEvent } from "@/server-fns/get-event";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const viewer = await getStaffViewer();
    if (!viewer.ok) {
      throw redirect({ to: viewer.error.status === 401 ? "/login" : "/portal" });
    }
    return { user: viewer.data };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const event = useQuery({
    queryKey: ["event", "ai-engineer-nyc-2026"],
    queryFn: () => getEvent(),
  });

  if (event.data === undefined) return null;
  if (!event.data.ok) return <p className="p-6">{event.data.error.message}</p>;

  return <AdminShell eventName={event.data.data.name} user={user} />;
}
