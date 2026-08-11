import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/app/admin-shell";
import { CreateEventForm } from "@/components/events/create-event-form";
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
      throw redirect({
        to:
          viewer.error.status === 401
            ? "/login"
            : viewer.error.status === 428
              ? "/onboarding"
              : "/portal",
      });
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
  if (event === undefined)
    return (
      <main className="min-h-svh bg-background">
        <header className="flex h-12 items-center border-b px-4 text-sm font-medium">
          {user.organizationName}
        </header>
        <div className="mx-auto max-w-xl px-5 py-16">
          <div className="text-center">
            <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              01
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Create your first event</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {user.organizationName} is ready. Add an event to open the admin workspace.
            </p>
          </div>
          <div className="mt-8 rounded-lg border p-4 sm:p-5">
            <CreateEventForm
              onCreated={async (eventId) => {
                await bootstrap.refetch();
                window.localStorage.setItem("opensesh-event-id", eventId);
                window.location.assign("/admin");
              }}
            />
          </div>
        </div>
      </main>
    );

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
