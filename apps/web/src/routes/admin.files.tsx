import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { FilesLibrary } from "@/components/admin/files-library";
import { adminPortalQuery } from "@/lib/portal-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

export const Route = createFileRoute("/admin/files")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
    deliverable: typeof search.deliverable === "string" ? search.deliverable : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) await context.queryClient.ensureQueryData(adminPortalQuery(eventId));
  },
  component: FilesRoute,
});

function FilesRoute() {
  const search = Route.useSearch();
  return <FilesLibrary spotlightId={search.spotlight} deliverableId={search.deliverable} />;
}
