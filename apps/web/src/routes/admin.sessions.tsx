import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SessionsPage, type SessionStateFilter } from "@/components/sessions/sessions-page";
import { resolveActiveEvent } from "@/lib/active-event";
import { adminEventsQuery, sessionListQuery } from "@/lib/review-desk-queries";
import { adminPortalQuery } from "@/lib/portal-queries";

const parseState = (value: unknown): SessionStateFilter =>
  value === "active" || value === "cancelled" ? value : "all";

export const Route = createFileRoute("/admin/sessions")({
  validateSearch: (search: Record<string, unknown>) => ({
    state: parseState(search.state),
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) {
      await Promise.all([
        context.queryClient.ensureQueryData(sessionListQuery(eventId)),
        // The Add-session dialog needs the speaker directory.
        context.queryClient.ensureQueryData(adminPortalQuery(eventId)),
      ]);
    }
  },
  component: SessionsRoute,
});

function SessionsRoute() {
  const { state, spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SessionsPage
      state={state}
      spotlightId={spotlight}
      onStateChange={(next) =>
        void navigate({ search: (current) => ({ ...current, state: next }), replace: true })
      }
      onSpotlightChange={(id, options) =>
        void navigate({
          search: (current) => ({ ...current, spotlight: id }),
          replace: options.replace,
        })
      }
    />
  );
}
