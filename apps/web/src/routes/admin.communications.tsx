import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { CommunicationsPage } from "@/components/admin/communications-page";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

export const Route = createFileRoute("/admin/communications")({
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined)
      await context.queryClient.ensureQueryData(communicationCenterQuery(eventId));
  },
  component: CommunicationsPage,
});
