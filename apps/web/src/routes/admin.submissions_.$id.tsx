import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { SubmissionDetail } from "@/components/review-desk/submission-detail";
import { adminEventsQuery, reviewDeskDetailQuery } from "@/lib/review-desk-queries";

export const Route = createFileRoute("/admin/submissions_/$id")({
  loader: async ({ context, params }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(reviewDeskDetailQuery(eventId, params.id));
    }
  },
  component: SubmissionDetailRoute,
});

function SubmissionDetailRoute() {
  const { id } = Route.useParams();
  return <SubmissionDetail id={id} />;
}
