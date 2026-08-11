import type { DashboardStats } from "@opensesh/domain/server/repos";
import { ChevronRightIcon, CircleCheckIcon, CircleDashedIcon, CircleDotIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Phase {
  readonly key: string;
  readonly title: string;
  readonly done: boolean;
  readonly summary: string;
  readonly href: string;
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
      done: l.tracks > 0 && l.rooms > 0,
      summary:
        l.tracks > 0 || l.rooms > 0
          ? `${plural(l.tracks, "track")} · ${plural(l.formats, "format")} · ${plural(l.rooms, "room")}`
          : "Tracks, formats, and rooms shape every later step.",
      href: "/admin/settings/library",
      action: "Configure library",
    },
    {
      key: "cfp",
      title: "Open the call for papers",
      done: l.forms > 0,
      summary:
        l.forms > 0
          ? `${plural(l.forms, "form")} · ${l.openForms} open`
          : "Publish a submission form so speakers can propose talks.",
      href: "/admin/forms",
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
      href: "/admin/abstracts?status=all",
      action: "View submissions",
    },
    {
      key: "evaluate",
      title: "Evaluate proposals",
      done: stats.submitted > 0 && stats.reviewed >= stats.submitted,
      summary:
        l.rounds === 0
          ? "Create a review round and assign reviewers."
          : `${stats.reviewed} of ${stats.submitted} reviewed · ${plural(l.rounds, "round")}`,
      href: "/admin/evaluation",
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
      href: "/admin/abstracts?status=pending",
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
      href: "/admin/tasks",
      action: l.tasksTotal === 0 ? "Add task" : "Track tasks",
    },
    {
      key: "publish",
      title: "Schedule and publish",
      done: stats.accepted > 0 && stats.acceptedUnscheduled === 0 && stats.conflicts === 0,
      summary:
        stats.scheduled > 0
          ? `${stats.scheduled} scheduled · ${stats.acceptedUnscheduled} unscheduled · ${plural(stats.conflicts, "conflict")}`
          : "Place accepted sessions on the agenda, then publish.",
      href: "/admin/agenda?view=rooms",
      action: "Open agenda",
    },
  ];
};

export function ProgramLifecycle({ stats }: { readonly stats: DashboardStats }) {
  const phases = derivePhases(stats);
  const doneCount = phases.filter((phase) => phase.done).length;
  if (doneCount === phases.length) return null;
  const current = phases.find((phase) => !phase.done);

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
        {phases.map((phase) => {
          const isCurrent = phase.key === current?.key;
          return (
            <a
              key={phase.key}
              href={phase.href}
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
                <Button size="xs" className="pressable pointer-events-none shrink-0">
                  {phase.action}
                </Button>
              ) : (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
