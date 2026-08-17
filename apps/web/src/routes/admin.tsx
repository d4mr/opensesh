import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import {
  activeEventIdFromCookieHeader,
  resolveActiveEvent,
  storeActiveEventId,
} from "@/lib/active-event";
import { adminEventsQuery } from "@/lib/review-desk-queries";
import { qk } from "@/lib/query-keys";
import { getActiveEventIdCookie } from "@/server-fns/active-event";
import { AdminShell } from "@/components/app/admin-shell";
import { RouteError } from "@/components/app/route-error";
import { CreateEventForm } from "@/components/events/create-event-form";
import { getStaffViewer } from "@/server-fns/auth";

const staffViewerQuery = queryOptions({
  queryKey: qk.viewer.staff,
  queryFn: () => getStaffViewer(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context, location }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData(staffViewerQuery);
    if (!viewer.ok) {
      if (viewer.error.status === 401) {
        throw redirect({
          to: "/login",
          search: {
            demo: undefined,
            email: undefined,
            error: undefined,
            // Sign-in returns to the page the admin was headed for.
            redirect: location.href,
          },
        });
      }
      throw redirect({ to: viewer.error.status === 428 ? "/onboarding" : "/portal" });
    }
    // The selected event travels as a cookie so this resolves identically on
    // the server (SSR) and the client (navigations) — child loaders prefetch
    // the SAME event the layout renders.
    const activeEventId =
      typeof document === "undefined"
        ? await getActiveEventIdCookie()
        : activeEventIdFromCookieHeader(document.cookie);
    return { user: viewer.data, activeEventId };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminEventsQuery),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, activeEventId } = Route.useRouteContext();
  const [selectedId, setSelectedId] = useState<string | null>(activeEventId);
  const bootstrap = useSuspenseQuery(adminEventsQuery);

  if (!bootstrap.data.ok) return <RouteError error={bootstrap.data.error} fullScreen />;
  const event = resolveActiveEvent(bootstrap.data.data, selectedId);
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
                storeActiveEventId(eventId);
                window.location.assign("/admin");
              }}
            />
          </div>
        </div>
      </main>
    );

  const selectEvent = (eventId: string) => {
    storeActiveEventId(eventId);
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
