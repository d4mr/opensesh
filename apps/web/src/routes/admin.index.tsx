import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CalendarClockIcon, ExternalLinkIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { qk } from "@/lib/query-keys";
import { eventAccessFor } from "@/lib/event-access";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { RouteError } from "@/components/app/route-error";
import { Timestamp } from "@/components/app/timestamp";
import { DashboardAttention } from "@/components/dashboard-attention";
import { ProgramLifecycle } from "@/components/dashboard-lifecycle";
import { SectionCards } from "@/components/section-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/server-fns/dashboard";

const DataTable = lazy(() =>
  import("@/components/data-table").then((module) => ({ default: module.DataTable })),
);

const dashboardQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.dashboard(eventId),
    queryFn: () => getDashboardStats({ data: { eventId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/")({
  // The overview is an organizer surface (event-wide KPIs, every recent
  // submission) — a reviewer's home is their review queue.
  beforeLoad: ({ context }) => {
    const admin =
      context.activeEventId === null
        ? context.user.roles.admin
        : eventAccessFor(context.user, context.activeEventId).admin;
    if (!admin) throw redirect({ to: "/admin/evaluation" });
  },
  component: Dashboard,
});

// Pinned to the event timezone so SSR (UTC worker) and the client agree.
const closesIn = (closeDate: Date, timezone: string) => {
  const days = Math.ceil((closeDate.getTime() - Date.now()) / 86_400_000);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(closeDate);
  return days > 0 ? `CFP closes ${label} · ${days}d` : `CFP closed ${label}`;
};

function Dashboard() {
  const context = useAdminEvent();
  const stats = useSuspenseQuery(dashboardQuery(context?.event.id ?? ""));

  if (!stats.data.ok) return <RouteError error={stats.data.error} />;
  const data = stats.data.data;

  return (
    <div className="flex flex-1 flex-col text-sm">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6">
          <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-2">
              {data.cfpCloseDate === null || context === null ? null : (
                <Badge variant="outline" className="gap-1.5">
                  <CalendarClockIcon className="size-3" />
                  <Timestamp value={data.cfpCloseDate} timezone={context.event.timezone}>
                    {closesIn(data.cfpCloseDate, context.event.timezone)}
                  </Timestamp>
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/e/${data.eventSlug}`} target="_blank" rel="noreferrer">
                View public site
                <ExternalLinkIcon />
              </a>
            </Button>
          </div>
          {data.submitted === 0 && data.drafts === 0 ? (
            <ProgramLifecycle stats={data} />
          ) : (
            <>
              <SectionCards stats={data} linked />
              <ProgramLifecycle stats={data} />
              <DashboardAttention stats={data} />
              <Suspense fallback={null}>
                <DataTable data={data.recentSubmissions} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
