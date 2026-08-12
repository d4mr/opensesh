import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import {
  SubmissionTablePage,
  type SubmissionStatusFilter,
} from "@/components/review-desk/submission-table-page";
import { adminEventsQuery, reviewDeskListQuery } from "@/lib/review-desk-queries";
import { reviewDeskDetailQuery } from "@/lib/review-desk-queries";

const parseStatus = (value: unknown): SubmissionStatusFilter => {
  if (
    value === "pending" ||
    value === "maybe" ||
    value === "accepted" ||
    value === "declined" ||
    value === "withdrawn" ||
    value === "draft"
  ) {
    return value;
  }
  return "all";
};

export const Route = createFileRoute("/admin/abstracts")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseStatus(search.status),
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loaderDeps: ({ search }) => ({ spotlight: search.spotlight }),
  loader: async ({ context, deps }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(reviewDeskListQuery(eventId, "abstract"));
      if (deps.spotlight !== undefined) {
        void context.queryClient.prefetchQuery(reviewDeskDetailQuery(eventId, deps.spotlight));
      }
    }
  },
  component: AbstractsRoute,
});

function AbstractsRoute() {
  const { status, spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SubmissionTablePage
      kind="abstract"
      status={status}
      spotlightId={spotlight}
      onStatusChange={(next) =>
        void navigate({ search: (current) => ({ ...current, status: next }), replace: true })
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
