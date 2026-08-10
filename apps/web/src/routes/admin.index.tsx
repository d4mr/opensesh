import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { SectionCards } from "@/components/section-cards";
import { getDashboardStats } from "@/server-fns/dashboard";

const ChartAreaInteractive = lazy(() =>
  import("@/components/chart-area-interactive").then((module) => ({
    default: module.ChartAreaInteractive,
  })),
);
const DataTable = lazy(() =>
  import("@/components/data-table").then((module) => ({ default: module.DataTable })),
);

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => getDashboardStats() });

  if (stats.data === undefined) return null;
  if (!stats.data.ok) return <p className="p-4 text-sm">{stats.data.error.message}</p>;

  return (
    <div className="flex flex-1 flex-col text-sm">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6">
          <SectionCards stats={stats.data.data} />
          <Suspense fallback={null}>
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive data={stats.data.data.activity} />
            </div>
            <DataTable data={stats.data.data.recentSubmissions} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
