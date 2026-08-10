import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, EyeOffIcon, PlusIcon } from "lucide-react";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { formatDateTime } from "@/components/forms/datetime-picker";
import { ReviewerEvaluationWorkspace } from "@/components/evaluation/reviewer-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminEvaluationQuery, reviewerEvaluationQuery } from "@/lib/evaluation-queries";

export const Route = createFileRoute("/admin/evaluation")({
  component: EvaluationRoute,
});

function EvaluationRoute() {
  const { user } = Route.useRouteContext();
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const admin = useQuery({
    ...adminEvaluationQuery(eventId),
    enabled: user.roles.admin && eventId.length > 0,
  });
  const reviewer = useQuery({
    ...reviewerEvaluationQuery(eventId),
    enabled: !user.roles.admin && user.roles.reviewer && eventId.length > 0,
  });

  if (context === null) return null;
  if (!user.roles.admin) {
    if (reviewer.data === undefined) {
      return <p className="p-6 text-sm text-muted-foreground">Loading your assigned reviews…</p>;
    }
    if (!reviewer.data.ok) return <p className="p-6 text-sm">{reviewer.data.error.message}</p>;
    return (
      <ReviewerEvaluationWorkspace data={reviewer.data.data} timezone={context.event.timezone} />
    );
  }
  if (admin.data === undefined) {
    return <p className="p-6 text-sm text-muted-foreground">Loading evaluation rounds…</p>;
  }
  if (!admin.data.ok) return <p className="p-6 text-sm">{admin.data.error.message}</p>;

  const rounds = admin.data.data.rounds;
  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Evaluation rounds</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rounds.length} {rounds.length === 1 ? "round" : "rounds"} · scorecards, reviewer pools,
            assignments, and results
          </p>
        </div>
        <Button asChild size="sm" className="pressable">
          <Link to="/admin/evaluation/$roundId" params={{ roundId: "new" }}>
            <PlusIcon /> Create round
          </Link>
        </Button>
      </div>

      {rounds.length === 0 ? (
        <div className="grid min-h-72 place-items-center text-center">
          <div>
            <h2 className="font-semibold">No evaluation rounds</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a round to define its scorecard and reviewer pool.
            </p>
            <Button asChild size="sm" className="pressable mt-3">
              <Link to="/admin/evaluation/$roundId" params={{ roundId: "new" }}>
                <PlusIcon /> Create round
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="grid h-8 grid-cols-[minmax(15rem,1.4fr)_minmax(14rem,1fr)_8rem_9rem_11rem_2rem] items-center gap-3 border-b bg-muted/40 px-3 text-[11px] font-medium text-muted-foreground">
            <span>Round</span>
            <span>Window</span>
            <span>Review type</span>
            <span>Reviewers</span>
            <span>Progress</span>
            <span />
          </div>
          {rounds.map((view) => {
            const round = view.configuration.round;
            const total = view.assignments.length;
            const completed = view.assignments.filter(
              (assignment) => assignment.status === "completed",
            ).length;
            const recused = view.assignments.filter(
              (assignment) => assignment.status === "recused",
            ).length;
            const required = total - recused;
            const percent = required === 0 ? 0 : Math.round((completed / required) * 100);
            return (
              <Link
                key={round.id}
                to="/admin/evaluation/$roundId"
                params={{ roundId: round.id }}
                className="pressable grid min-h-12 grid-cols-[minmax(15rem,1.4fr)_minmax(14rem,1fr)_8rem_9rem_11rem_2rem] items-center gap-3 border-b px-3 last:border-b-0 hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{round.name}</span>
                  <span className="mt-0.5 block text-[11px] capitalize text-muted-foreground">
                    Position {round.position} · {round.status} ·{" "}
                    {view.configuration.criteria.length} criteria
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(round.opensAt.toISOString(), context.event.timezone)}
                  <span className="block">
                    to {formatDateTime(round.closesAt.toISOString(), context.event.timezone)}
                  </span>
                </span>
                <span>
                  {round.blind ? (
                    <Badge variant="outline" className="gap-1">
                      <EyeOffIcon className="size-3" /> Blind
                    </Badge>
                  ) : (
                    <Badge variant="outline">Identified</Badge>
                  )}
                </span>
                <span className="text-xs tabular-nums">
                  {view.reviewers.length} {view.reviewers.length === 1 ? "reviewer" : "reviewers"}
                </span>
                <span>
                  <span className="block text-xs font-medium tabular-nums">
                    {completed}/{required} complete · {percent}%
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-primary" style={{ width: `${percent}%` }} />
                  </span>
                </span>
                <ArrowRightIcon className="size-3.5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
