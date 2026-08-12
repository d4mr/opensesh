import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { EvaluationRoundEditor } from "@/components/evaluation/round-editor";
import { adminEvaluationQuery } from "@/lib/evaluation-queries";
import { eventAccessFor } from "@/lib/event-access";

export const Route = createFileRoute("/admin/evaluation_/$roundId")({
  beforeLoad: ({ context }) => {
    const admin =
      context.activeEventId === null
        ? context.user.roles.admin
        : eventAccessFor(context.user, context.activeEventId).admin;
    if (!admin) throw redirect({ to: "/admin/evaluation" });
  },
  component: EvaluationRoundRoute,
});

function EvaluationRoundRoute() {
  const context = useAdminEvent();
  const { roundId } = Route.useParams();
  const eventId = context?.event.id ?? "";
  const evaluation = useQuery({
    ...adminEvaluationQuery(eventId),
    enabled: eventId.length > 0,
  });
  if (context === null) return null;
  if (evaluation.data === undefined) {
    return <p className="p-6 text-sm text-muted-foreground">Loading round workspace…</p>;
  }
  if (!evaluation.data.ok) return <p className="p-6 text-sm">{evaluation.data.error.message}</p>;
  const view = evaluation.data.data.rounds.find(
    (round) => round.configuration.round.id === roundId,
  );
  if (roundId !== "new" && view === undefined) {
    return <p className="p-6 text-sm">Review round not found.</p>;
  }
  return (
    <EvaluationRoundEditor
      key={`${eventId}-${roundId}`}
      eventId={eventId}
      timezone={context.event.timezone}
      workspace={evaluation.data.data}
      view={view}
    />
  );
}
