import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClockIcon, ExternalLinkIcon, FileInputIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Timestamp } from "@/components/app/timestamp";
import { DashboardAttention } from "@/components/dashboard-attention";
import { ProgramLifecycle } from "@/components/dashboard-lifecycle";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SectionCards } from "@/components/section-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/server-fns/dashboard";

const DataTable = lazy(() =>
  import("@/components/data-table").then((module) => ({ default: module.DataTable })),
);

const dashboardQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["dashboard-stats", eventId],
    queryFn: () => getDashboardStats({ data: { eventId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/")({
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
  const { user } = Route.useRouteContext();
  const context = useAdminEvent();
  const stats = useSuspenseQuery(dashboardQuery(context?.event.id ?? ""));

  if (!stats.data.ok) return <p className="p-4 text-sm">{stats.data.error.message}</p>;
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
            user.roles.admin ? (
              <ProgramLifecycle stats={data} />
            ) : (
              <AdminEmptyState
                icon={FileInputIcon}
                title="Your program starts with a call for papers"
                description="Create a submission form to collect the first proposals for this event."
                action={
                  <Button asChild size="sm" className="pressable">
                    <a href="/admin/forms">Create call for papers</a>
                  </Button>
                }
              />
            )
          ) : (
            <>
              <SectionCards stats={data} linked={user.roles.admin} />
              {user.roles.admin ? <ProgramLifecycle stats={data} /> : null}
              {user.roles.admin ? <DashboardAttention stats={data} /> : null}
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
