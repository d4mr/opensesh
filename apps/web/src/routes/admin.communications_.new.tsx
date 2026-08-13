import type { AudienceSegment } from "@opensesh/domain";
import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { CampaignComposerPage } from "@/components/admin/campaign-composer";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

const audiences: ReadonlySet<string> = new Set([
  "all_speakers",
  "confirmed",
  "awaiting_confirmation",
  "incomplete_tasks",
  "selected",
  "all_submitters",
  "awaiting_decision",
  "declined",
  "selected_submitters",
] satisfies ReadonlyArray<AudienceSegment>);

export const Route = createFileRoute("/admin/communications_/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    audience:
      typeof search.audience === "string" && audiences.has(search.audience)
        ? (search.audience as AudienceSegment)
        : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined)
      await context.queryClient.ensureQueryData(communicationCenterQuery(eventId));
  },
  component: ComposerRoute,
});

function ComposerRoute() {
  const { audience, from } = Route.useSearch();
  return <CampaignComposerPage presetAudience={audience} fromCampaignId={from} />;
}
