import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { UsersRoundIcon } from "lucide-react";

import { qk } from "@/lib/query-keys";
import { PortalShell } from "@/components/app/portal-shell";
import { Button } from "@/components/ui/button";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { getViewer } from "@/server-fns/auth";
import { getEvent } from "@/server-fns/get-event";

const portalViewerQuery = queryOptions({
  queryKey: qk.viewer.portal,
  queryFn: () => getViewer(),
  staleTime: 5 * 60_000,
});

const portalEventQuery = queryOptions({
  queryKey: qk.viewer.portalEvent,
  queryFn: () => getEvent(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/portal")({
  beforeLoad: async ({ context }) => {
    // Cached so in-app navigation stays instant; full-page reloads on
    // login/logout/persona-switch reset the client and force a fresh check.
    const viewer = await context.queryClient.ensureQueryData(portalViewerQuery);
    if (!viewer.ok) {
      throw redirect({ to: "/login", search: { demo: undefined, email: undefined } });
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
  const portal = useSuspenseQuery(speakerPortalQuery);

  if (!event.data.ok) return <PortalUnavailable message={event.data.error.message} />;
  if (!portal.data.ok) return <PortalUnavailable message={portal.data.error.message} />;
  const preview = "preview" in portal.data.data ? portal.data.data.preview : undefined;

  return <PortalShell event={event.data.data} user={user} preview={preview} />;
}

function PortalUnavailable({ message }: { readonly message: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 text-center shadow-xs">
        <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UsersRoundIcon className="size-4" />
        </span>
        <h1 className="text-base font-semibold tracking-tight">No portal to show</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link to="/admin">Back to the admin desk</Link>
        </Button>
      </div>
    </main>
  );
}
