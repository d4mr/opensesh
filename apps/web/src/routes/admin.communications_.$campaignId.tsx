import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { CampaignPage } from "@/components/admin/campaign-page";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

export const Route = createFileRoute("/admin/communications_/$campaignId")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined)
      await context.queryClient.ensureQueryData(communicationCenterQuery(eventId));
  },
  component: CampaignRoute,
});

function CampaignRoute() {
  const { campaignId } = Route.useParams();
  const { spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <CampaignPage
      campaignId={campaignId}
      spotlightId={spotlight}
      onSpotlightChange={(id, options) =>
        void navigate({ search: { spotlight: id }, replace: options.replace })
      }
    />
  );
}
