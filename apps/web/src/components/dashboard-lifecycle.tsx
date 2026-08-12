import type { DashboardStats } from "@opensesh/domain/server/repos";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, CircleCheckIcon, CircleDashedIcon, CircleDotIcon } from "lucide-react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Phase {
  readonly key: "library" | "cfp" | "collect" | "evaluate" | "decide" | "onboard" | "publish";
  readonly title: string;
  readonly done: boolean;
  readonly summary: string;
  readonly action: string;
}

const plural = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;

// Every phase is derived from live event data — nothing here is checked off
// by hand, so the guide can never drift from reality.
const derivePhases = (stats: DashboardStats): ReadonlyArray<Phase> => {
  const l = stats.lifecycle;
  return [
    {
      key: "library",
      title: "Set up the event library",
      done: l.tracks > 0 && l.formats > 0 && l.rooms > 0,
      summary:
        l.tracks > 0 || l.formats > 0 || l.rooms > 0
          ? `${plural(l.tracks, "track")} · ${plural(l.formats, "format")} · ${plural(l.rooms, "room")}`
          : "Tracks, formats, and rooms shape every later step.",
      action: "Configure library",
    },
    {
      key: "cfp",
      title: "Open the call for papers",
      // A closed CFP that already gathered submissions did its job; only an
      // event with no open form and nothing collected is still waiting here.
      done: l.openForms > 0 || (l.forms > 0 && stats.submitted > 0),
      summary:
        l.forms > 0
          ? `${plural(l.forms, "form")} · ${l.openForms} open`
          : "Publish a submission form so speakers can propose talks.",
      action: l.forms > 0 ? "Manage forms" : "Create form",
    },
    {
      key: "collect",
      title: "Collect submissions",
      done: stats.submitted > 0,
      summary:
        stats.submitted > 0
          ? `${stats.submitted} submitted · ${plural(stats.drafts, "draft")}`
          : "Share the public form link once the CFP is live.",
      action: "View submissions",
    },
    {
      key: "evaluate",
      title: "Evaluate proposals",
      done: stats.reviewEligible > 0 && stats.reviewedEligible >= stats.reviewEligible,
      summary:
        l.rounds === 0
          ? "Create a review round and assign reviewers."
          : `${stats.reviewedEligible} of ${plural(stats.reviewEligible, "proposal")} reviewed · ${plural(l.rounds, "round")}`,
      action: l.rounds === 0 ? "Create round" : "Open evaluation",
    },
    {
      key: "decide",
      title: "Send decisions",
      done: stats.submitted > 0 && stats.pending === 0 && stats.maybe === 0,
      summary:
        stats.accepted + stats.declined > 0
          ? `${stats.accepted} accepted · ${stats.declined} declined · ${l.notified} notified`
          : "Accept or decline each proposal, then notify speakers.",
      action: "Review queue",
    },
    {
      key: "onboard",
      title: "Onboard speakers",
      done: l.tasksTotal > 0 && l.tasksComplete === l.tasksTotal,
      summary:
        l.tasksTotal === 0
          ? "Create speaker tasks for bios, headshots, and files."
          : `${l.tasksComplete} of ${l.tasksTotal} tasks complete`,
      action: l.tasksTotal === 0 ? "Add task" : "Track tasks",
    },
    {
      key: "publish",
      title: "Schedule and publish",
      done:
        stats.accepted > 0 &&
        stats.acceptedUnscheduled === 0 &&
        stats.conflicts === 0 &&
        stats.agendaPublished,
      summary:
        stats.scheduled > 0
          ? `${stats.scheduled} scheduled · ${stats.acceptedUnscheduled} unscheduled · ${plural(stats.conflicts, "conflict")} · ${stats.agendaPublished ? "published" : "not published"}`
          : "Place accepted sessions on the agenda, then publish.",
      action:
        stats.accepted > 0 && stats.acceptedUnscheduled === 0 && stats.conflicts === 0
          ? "Publish agenda"
          : "Open agenda",
    },
  ];
};

// Typed SPA links per phase — the decide step points at whichever decision
// queue still has work (pending first, then maybe) so the CTA never lands on
// an empty page.
function PhaseLink({
  phase,
  stats,
  className,
  children,
}: {
  readonly phase: Phase;
  readonly stats: DashboardStats;
  readonly className: string;
  readonly children: ReactNode;
}) {
  switch (phase.key) {
    case "library":
      return (
        <Link to="/admin/settings/library" className={className}>
          {children}
        </Link>
      );
    case "cfp":
      return (
        <Link to="/admin/forms" className={className}>
          {children}
        </Link>
      );
    case "collect":
      return (
        <Link
          to="/admin/submissions"
          search={{ status: "all", spotlight: undefined }}
          className={className}
        >
          {children}
        </Link>
      );
    case "evaluate":
      return (
        <Link to="/admin/evaluation" className={className}>
          {children}
        </Link>
      );
    case "decide":
      return (
        <Link
          to="/admin/submissions"
          search={{
            status: stats.pending > 0 ? "pending" : stats.maybe > 0 ? "maybe" : "all",
            spotlight: undefined,
          }}
          className={className}
        >
          {children}
        </Link>
      );
    case "onboard":
      return (
        <Link
          to="/admin/$section"
          params={{ section: "tasks" }}
          search={{ spotlight: undefined, fileRequest: undefined }}
          className={className}
        >
          {children}
        </Link>
      );
    case "publish":
      return (
        <Link
          to="/admin/agenda"
          search={{ view: "rooms", day: undefined, draft: undefined }}
          className={className}
        >
          {children}
        </Link>
      );
  }
}

function PhaseRows({
  phases,
  current,
  stats,
}: {
  readonly phases: ReadonlyArray<Phase>;
  readonly current: Phase | undefined;
  readonly stats: DashboardStats;
}) {
  return (
    <>
      {phases.map((phase) => {
        const isCurrent = phase.key === current?.key;
        return (
          <PhaseLink
            key={phase.key}
            phase={phase}
            stats={stats}
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
              isCurrent && "bg-muted/40",
            )}
          >
            {phase.done ? (
              <CircleCheckIcon className="size-4 shrink-0 text-status-accepted" />
            ) : isCurrent ? (
              <CircleDotIcon className="size-4 shrink-0 text-primary" />
            ) : (
              <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground/50" />
            )}
            <span className="min-w-0 flex-1 truncate">
              <span
                className={cn(
                  "text-sm font-medium",
                  phase.done && "text-muted-foreground",
                  !phase.done && !isCurrent && "text-muted-foreground",
                )}
              >
                {phase.title}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{phase.summary}</span>
            </span>
            {isCurrent ? (
              <span className={cn(buttonVariants({ size: "xs" }), "pointer-events-none shrink-0")}>
                {phase.action}
              </span>
            ) : (
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </PhaseLink>
        );
      })}
    </>
  );
}

export function ProgramLifecycle({ stats }: { readonly stats: DashboardStats }) {
  const phases = derivePhases(stats);
  const doneCount = phases.filter((phase) => phase.done).length;
  const current = phases.find((phase) => !phase.done);

  // Everything shipped: collapse to a quiet rail — the accomplishment and the
  // navigation map stay one click away instead of vanishing.
  if (doneCount === phases.length) {
    return (
      <section className="px-4 lg:px-6">
        <details className="group overflow-hidden rounded-lg border">
          <summary className="pressable flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-sm transition-colors hover:bg-muted/50">
            <CircleCheckIcon className="size-4 shrink-0 text-status-accepted" />
            <span className="font-medium">Program live</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {doneCount} of {phases.length} complete
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="divide-y border-t">
            <PhaseRows phases={phases} current={current} stats={stats} />
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="px-4 lg:px-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Program lifecycle</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {doneCount} of {phases.length} complete
        </span>
      </div>
      <div className="mb-3 flex gap-1">
        {phases.map((phase) => (
          <div
            key={phase.key}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300 [transition-timing-function:var(--ease-out)]",
              phase.done ? "bg-primary" : phase.key === current?.key ? "bg-primary/30" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">
        <PhaseRows phases={phases} current={current} stats={stats} />
      </div>
    </section>
  );
}
