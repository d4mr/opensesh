import type { DashboardSubmission } from "@opensesh/domain";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowRightIcon } from "lucide-react";

import { PersonTag } from "@/components/app/person-tag";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const table = useTable({ features, columns, data });

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Recent submissions</h2>
          <p className="text-sm text-muted-foreground">The latest 20 abstracts and sessions.</p>
        </div>
        <Button variant="link" size="sm" asChild className="shrink-0">
          <Link to="/admin/$section" params={{ section: "abstracts" }}>
            View all
            <ArrowRightIcon />
          </Link>
        </Button>
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
