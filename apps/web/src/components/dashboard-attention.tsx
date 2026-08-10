import type { DashboardStats } from "@opensesh/domain/server/repos";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

export function DashboardAttention({ stats }: { readonly stats: DashboardStats }) {
  const items = [
    {
      count: stats.pending,
      one: "submission awaiting a decision",
      many: "submissions awaiting a decision",
      section: "evaluation",
      destructive: false,
    },
    {
      count: stats.acceptedUnscheduled,
      one: "accepted session not yet scheduled",
      many: "accepted sessions not yet scheduled",
      section: "agenda",
      destructive: false,
    },
    {
      count: stats.conflicts,
      one: "schedule conflict to resolve",
      many: "schedule conflicts to resolve",
      section: "agenda",
      destructive: true,
    },
    {
      count: stats.drafts,
      one: "draft never submitted",
      many: "drafts never submitted",
      section: "abstracts",
      destructive: false,
    },
  ]
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, label: item.count === 1 ? item.one : item.many }));

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b !py-3">
          <CardTitle className="text-sm">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 text-status-accepted" />
              All clear — nothing is waiting on you.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item) => {
                const content = (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Badge
                        variant={item.destructive ? "destructive" : "secondary"}
                        className="min-w-7 justify-center tabular-nums"
                      >
                        {item.count}
                      </Badge>
                      {item.label}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </>
                );
                const className =
                  "flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50";
                return item.section === "agenda" ? (
                  <Link
                    key={item.label}
                    to="/admin/agenda"
                    search={{
                      view: item.destructive ? "conflicts" : "rooms",
                      day: undefined,
                      draft: undefined,
                    }}
                    className={className}
                  >
                    {content}
                  </Link>
                ) : item.section === "evaluation" ? (
                  <Link key={item.label} to="/admin/evaluation" className={className}>
                    {content}
                  </Link>
                ) : (
                  <Link
                    key={item.label}
                    to="/admin/abstracts"
                    search={{
                      status: item.section === "abstracts" ? "draft" : "all",
                      spotlight: undefined,
                    }}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b !py-3">
          <CardTitle className="text-sm">Agenda</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.agendaDays.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <CalendarDaysIcon className="size-4" />
              No sessions scheduled yet — accepted sessions land in the builder.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Day</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="pr-4 text-right">Rooms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.agendaDays.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="pl-4 font-medium">{dayLabel(day.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{day.sessions}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{day.rooms}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between border-t !py-3">
          <span className="text-xs text-muted-foreground">
            {stats.conflicts > 0
              ? `${stats.conflicts} ${stats.conflicts === 1 ? "conflict needs" : "conflicts need"} resolving`
              : "Draft — not published"}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/agenda" search={{ view: "rooms", day: undefined, draft: undefined }}>
              Open builder
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
