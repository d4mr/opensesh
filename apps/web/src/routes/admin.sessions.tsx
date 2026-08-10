import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  SubmissionTablePage,
  type SubmissionStatusFilter,
} from "@/components/review-desk/submission-table-page";
import { adminEventsQuery, reviewDeskListQuery } from "@/lib/review-desk-queries";

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

export const Route = createFileRoute("/admin/sessions")({
  validateSearch: (search: Record<string, unknown>) => ({ status: parseStatus(search.status) }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(reviewDeskListQuery(eventId, "session"));
    }
  },
  component: SessionsRoute,
});

function SessionsRoute() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SubmissionTablePage
      kind="session"
      status={status}
      onStatusChange={(next) => void navigate({ search: { status: next }, replace: true })}
    />
  );
}
