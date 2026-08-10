import type { DashboardSubmission } from "@opensesh/domain";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { PersonTag } from "@/components/app/person-tag";
import { StatusBadge, statusIcon } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const statusTabs = ["all", "pending", "maybe", "accepted", "declined"] as const;
type StatusTab = (typeof statusTabs)[number];

const statusTextClass: Readonly<Record<Exclude<StatusTab, "all">, string>> = {
  pending: "text-status-pending",
  maybe: "text-status-maybe",
  accepted: "text-status-accepted",
  declined: "text-status-declined",
};

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, DashboardSubmission>();
const columns = columnHelper.columns([
  columnHelper.accessor("code", {
    header: "Code",
    cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.code}</span>,
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  }),
  columnHelper.accessor("kind", {
    header: "Kind",
    cell: ({ row }) => <span className="capitalize">{row.original.kind}</span>,
  }),
  columnHelper.accessor("track", {
    header: "Track",
    cell: ({ row }) => row.original.track ?? <span className="text-muted-foreground">—</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),
  columnHelper.accessor("reviewer", {
    header: "Reviewer",
    cell: ({ row }) => <PersonTag person={row.original.reviewer} />,
  }),
]);

export function DataTable({ data }: { readonly data: ReadonlyArray<DashboardSubmission> }) {
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const filtered = statusTab === "all" ? data : data.filter((row) => row.status === statusTab);
  const table = useTable({ features, columns, data: filtered });
  const countFor = (tab: StatusTab) =>
    tab === "all" ? data.length : data.filter((row) => row.status === tab).length;

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Recent submissions</h2>
          <p className="text-sm text-muted-foreground">
            Newest first, across abstracts and sessions.
          </p>
        </div>
        <Button variant="link" size="sm" asChild className="shrink-0">
          <Link to="/admin/abstracts" search={{ status: "all" }}>
            View all
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>
      <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-1" role="group">
        {statusTabs.map((tab) => {
          const active = statusTab === tab;
          const Icon = tab === "all" ? null : statusIcon[tab];
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusTab(tab)}
              className={cn(
                "pressable flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium capitalize transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon === null ? null : (
                <Icon
                  className={cn("size-3.5", statusTextClass[tab as Exclude<StatusTab, "all">])}
                />
              )}
              {tab}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  tab === "all"
                    ? "text-muted-foreground/70"
                    : statusTextClass[tab as Exclude<StatusTab, "all">],
                )}
              >
                {countFor(tab)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No submissions yet.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
