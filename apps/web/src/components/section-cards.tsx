import type { DashboardStats } from "@opensesh/domain/server/repos";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards({ stats }: { readonly stats: DashboardStats }) {
  const cards = [
    {
      label: "Submissions",
      value: String(stats.submitted),
      badge: stats.drafts > 0 ? `${stats.drafts} drafts` : "All formats",
      detail: `${stats.pending} pending · ${stats.maybe} maybe · ${stats.accepted} accepted`,
      section: "abstracts",
    },
    {
      label: "Review progress",
      value: `${stats.reviewed} of ${stats.submitted}`,
      badge: "Reviews",
      detail:
        stats.submitted - stats.reviewed > 0
          ? `${stats.submitted - stats.reviewed} awaiting first review`
          : "Every submission reviewed",
      section: "evaluation",
    },
    {
      label: "Speakers",
      value: String(stats.speakers),
      badge: "Directory",
      detail: "Everyone attached to this event",
      section: "speakers",
    },
    {
      label: "Agenda",
      value: `${stats.scheduled} of ${stats.accepted}`,
      badge:
        stats.conflicts > 0
          ? `${stats.conflicts} ${stats.conflicts === 1 ? "conflict" : "conflicts"}`
          : "Draft",
      badgeDestructive: stats.conflicts > 0,
      detail:
        stats.acceptedUnscheduled > 0
          ? `${stats.acceptedUnscheduled} accepted sessions unscheduled`
          : "All accepted sessions scheduled",
      section: "agenda",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Link
          key={card.label}
          to="/admin/$section"
          params={{ section: card.section }}
          className="group/stat block"
        >
          <Card className="@container/card h-full transition-colors group-hover/stat:border-foreground/20">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {card.value}
              </CardTitle>
              <CardAction>
                <Badge
                  variant={
                    "badgeDestructive" in card && card.badgeDestructive ? "destructive" : "outline"
                  }
                >
                  {card.badge}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="text-muted-foreground">{card.detail}</div>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
