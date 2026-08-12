import type { SessionListItem } from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
  SearchIcon,
  SquareStackIcon,
} from "lucide-react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddSessionDialog } from "@/components/admin/add-session-dialog";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpotlightLayout } from "@/components/app/spotlight";
import { relativeLabel, Timestamp } from "@/components/app/timestamp";
import { CancelSessionDialog } from "@/components/sessions/cancel-session-dialog";
import { ReinstateSessionDialog } from "@/components/sessions/reinstate-session-dialog";
import { SessionSpotlight } from "@/components/sessions/session-spotlight";
import { Button } from "@/components/ui/button";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { sessionListQuery } from "@/lib/review-desk-queries";
import { cn } from "@/lib/utils";
import { deleteManualSession } from "@/server-fns/sessions";

export type SessionStateFilter = "all" | "active" | "cancelled";

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
const columnHelper = createColumnHelper<typeof features, SessionListItem>();

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

// Sessions have no acceptance status — every row here is an accepted
// submission or a manually added session. The columns are readiness facts;
// the only lifecycle state is Cancelled.
export function SessionsPage({
  state,
  spotlightId,
  onStateChange,
  onSpotlightChange,
}: {
  readonly state: SessionStateFilter;
  readonly spotlightId: string | undefined;
  readonly onStateChange: (state: SessionStateFilter) => void;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const timezone = context?.event.timezone ?? "UTC";
  const list = useSuspenseQuery(sessionListQuery(eventId));
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("all");
  const [format, setFormat] = useState("all");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SessionListItem>();
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateTarget, setReinstateTarget] = useState<SessionListItem>();
  const [deleting, setDeleting] = useState(false);

  const data = list.data.ok ? list.data.data : null;
  const filtered = useMemo(() => {
    if (data === null) return [];
    const query = search.trim().toLowerCase();
    return data.sessions.filter((session) => {
      if (state === "active" && session.cancelledAt !== null) return false;
      if (state === "cancelled" && session.cancelledAt === null) return false;
      if (track !== "all" && !session.tracks.some((item) => item.id === track)) return false;
      if (format !== "all" && session.format !== format) return false;
      if (query.length === 0) return true;
      return [
        session.title,
        session.code,
        ...session.speakers.flatMap((speaker) => [speaker.name, speaker.email]),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [data, format, search, state, track]);

  const refresh = () => invalidateAfterMutation(queryClient, eventId);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("code", {
          header: "Code",
          cell: ({ row }) => (
            <span className="font-mono text-xs tabular-nums">{row.original.code}</span>
          ),
        }),
        columnHelper.accessor("title", {
          header: "Title",
          cell: ({ row }) => (
            <span className="flex max-w-80 items-center gap-1.5">
              <span
                className={cn(
                  "block truncate font-medium",
                  row.original.cancelledAt === null ? "" : "text-muted-foreground line-through",
                )}
              >
                {row.original.title}
              </span>
              {row.original.cancelledAt === null ? null : (
                <span
                  className="shrink-0 rounded-sm border border-destructive/40 px-1 py-px text-[10px] text-destructive"
                  title={`Cancelled by the ${row.original.cancelledBy ?? "organizer"}`}
                >
                  Cancelled
                </span>
              )}
            </span>
          ),
        }),
        columnHelper.accessor(
          (session) => session.speakers.map((speaker) => speaker.name).join(", "),
          {
            id: "speakers",
            header: "Speakers",
            cell: ({ row }) => (
              <div className="flex items-center gap-2">
                {row.original.speakers.map((speaker) => (
                  <span key={speaker.id} className="inline-flex items-center gap-1">
                    <SpeakerBadge
                      person={{ id: speaker.id, name: speaker.name, image: speaker.headshotUrl }}
                    />
                    {speaker.confirmedAt === null ? (
                      <CircleDashedIcon
                        className="size-3 text-[var(--status-pending)]"
                        aria-label={`${speaker.name} has not confirmed`}
                      />
                    ) : null}
                  </span>
                ))}
              </div>
            ),
          },
        ),
        columnHelper.accessor("startsAt", {
          id: "schedule",
          header: "Schedule",
          sortUndefined: "last",
          cell: ({ row }) =>
            row.original.startsAt === null ? (
              <span className="text-xs text-muted-foreground">Unscheduled</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                <Timestamp value={row.original.startsAt} timezone={timezone}>
                  {relativeLabel(row.original.startsAt)}
                </Timestamp>
                {row.original.roomName === null ? "" : ` · ${row.original.roomName}`}
              </span>
            ),
        }),
        columnHelper.accessor(
          (session) =>
            session.deliverablesTotal === 0
              ? -1
              : session.deliverablesUploaded / session.deliverablesTotal,
          {
            id: "deliverables",
            header: "Deliverables",
            cell: ({ row }) =>
              row.original.deliverablesTotal === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    row.original.deliverablesUploaded === row.original.deliverablesTotal
                      ? "text-status-accepted"
                      : "text-muted-foreground",
                  )}
                >
                  {row.original.deliverablesUploaded}/{row.original.deliverablesTotal}
                </span>
              ),
          },
        ),
        columnHelper.accessor(
          (session) => (session.tasksTotal === 0 ? -1 : session.tasksDone / session.tasksTotal),
          {
            id: "tasks",
            header: "Tasks",
            cell: ({ row }) =>
              row.original.tasksTotal === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    row.original.tasksDone === row.original.tasksTotal
                      ? "text-status-accepted"
                      : "text-muted-foreground",
                  )}
                >
                  {row.original.tasksDone}/{row.original.tasksTotal}
                </span>
              ),
          },
        ),
        columnHelper.accessor("publicationApproved", {
          id: "publication",
          header: "Publication",
          cell: ({ row }) =>
            row.original.publicationApproved ? (
              <span className="inline-flex items-center gap-1 text-xs text-status-accepted">
                <CheckCircle2Icon className="size-3.5" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CircleDashedIcon className="size-3.5 text-[var(--status-pending)]" /> Not public
              </span>
            ),
        }),
        columnHelper.accessor("source", {
          header: "Source",
          cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">
              {row.original.source === "cfp" ? "CFP" : "Manual"}
            </span>
          ),
        }),
      ]),
    [timezone],
  );

  const table = useTable(
    {
      features,
      columns,
      data: filtered,
      getRowId: (row) => row.id,
      enableSortingRemoval: false,
      initialState: { sorting: [{ id: "schedule", desc: false }] },
    },
    (tableState) => ({ sorting: tableState.sorting }),
  );
  const tableRows = table.getRowModel().rows;
  const pages = usePagination(tableRows, {
    resetKey: `${state}:${search}:${track}:${format}`,
    spotlightId,
    getId: (row) => row.original.id,
  });

  if (context === null) return null;
  if (!list.data.ok) return <p className="p-6 text-sm">{list.data.error.message}</p>;
  const readyData = list.data.data;
  const cancelledCount = readyData.sessions.filter(
    (session) => session.cancelledAt !== null,
  ).length;
  const spotlightSession = readyData.sessions.find((session) => session.id === spotlightId);

  const exportCsv = () => {
    const rows = tableRows.map((row) => row.original);
    const lines = [
      [
        "Code",
        "Title",
        "Speakers",
        "Schedule",
        "Room",
        "Deliverables",
        "Tasks",
        "Publication",
        "Source",
        "State",
      ]
        .map(csvCell)
        .join(","),
      ...rows.map((session) =>
        [
          session.code,
          session.title,
          session.speakers.map((speaker) => speaker.name).join("; "),
          session.startsAt?.toISOString() ?? "",
          session.roomName ?? "",
          session.deliverablesTotal === 0
            ? ""
            : `${session.deliverablesUploaded}/${session.deliverablesTotal}`,
          session.tasksTotal === 0 ? "" : `${session.tasksDone}/${session.tasksTotal}`,
          session.publicationApproved ? "approved" : "pending",
          session.source,
          session.cancelledAt === null ? "active" : `cancelled (${session.cancelledBy ?? ""})`,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sessions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? "row" : "rows"} to sessions.csv`);
  };

  const remove = async (session: SessionListItem) => {
    setDeleting(true);
    const result = await deleteManualSession({
      data: { eventId, submissionId: session.id },
    });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    onSpotlightChange(undefined, { replace: true, keyboard: false });
    toast.success(`${session.code} deleted`);
    await refresh();
  };

  if (readyData.sessions.length === 0) {
    return (
      <main className="p-4 text-sm lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Sessions</h1>
            <p className="text-sm text-muted-foreground">
              Accepted submissions and manually added sessions for {context.event.name}.
            </p>
          </div>
          <AddSessionDialog
            eventId={eventId}
            onCreated={(id) => onSpotlightChange(id, { replace: false, keyboard: false })}
          />
        </div>
        <AdminEmptyState
          icon={SquareStackIcon}
          title="No sessions yet"
          description="Accept a submission — or add a session directly — and it appears here with its readiness."
          action={
            <Button asChild size="sm" className="pressable">
              <Link to="/admin/submissions" search={{ status: "all", spotlight: undefined }}>
                Review submissions
              </Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={tableRows.map((row) => row.original.id)}
        onSpotlightChange={onSpotlightChange}
        clearFilters={() => {
          setSearch("");
          setTrack("all");
          setFormat("all");
          onStateChange("all");
        }}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col p-4 lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">Sessions</h1>
                <p className="text-sm text-muted-foreground">
                  Accepted submissions and manually added sessions for {context.event.name}.
                </p>
              </div>
              <AddSessionDialog
                eventId={eventId}
                onCreated={(id) => onSpotlightChange(id, { replace: false, keyboard: false })}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-56 flex-1 sm:max-w-sm">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search sessions…"
                    className="h-8 pl-8"
                  />
                </div>
                {cancelledCount === 0 ? null : (
                  <Select
                    value={state}
                    onValueChange={(value) => {
                      if (value === "all" || value === "active" || value === "cancelled")
                        onStateChange(value);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled ({cancelledCount})</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={track} onValueChange={(value) => value !== null && setTrack(value)}>
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tracks</SelectItem>
                    {readyData.tracks.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={format}
                  onValueChange={(value) => value !== null && setFormat(value)}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    {readyData.formats.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {search === "" && track === "all" && format === "all" && state === "all" ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      setSearch("");
                      setTrack("all");
                      setFormat("all");
                      onStateChange("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
                <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
                  <DownloadIcon /> Export CSV
                </Button>
              </div>

              <TableShell
                scrollRef={scrollRef}
                footer={
                  <PaginationFooter
                    page={pages.page}
                    pageSize={pages.pageSize}
                    total={tableRows.length}
                    onPageChange={pages.setPage}
                  />
                }
              >
                <Table>
                  <TableHeader>
                    {compact ? (
                      <TableRow className="h-8 hover:bg-transparent">
                        <TableHead className="h-8 w-24 text-xs">Code</TableHead>
                        <TableHead className="h-8 text-xs">Title</TableHead>
                        <TableHead className="h-8 w-36 text-xs">Schedule</TableHead>
                      </TableRow>
                    ) : (
                      table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id} className="h-8 hover:bg-transparent">
                          {group.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              colSpan={header.colSpan}
                              className="h-8 text-xs"
                            >
                              {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1"
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  <table.FlexRender header={header} />
                                  {header.column.getIsSorted() === "asc" ? (
                                    <ArrowUpIcon className="size-3" />
                                  ) : header.column.getIsSorted() === "desc" ? (
                                    <ArrowDownIcon className="size-3" />
                                  ) : (
                                    <ArrowUpDownIcon className="size-3 text-muted-foreground" />
                                  )}
                                </button>
                              ) : (
                                <table.FlexRender header={header} />
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableHeader>
                  <TableBody>
                    {tableRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={table.getVisibleLeafColumns().length}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No sessions match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pages.pageItems.map((row) => (
                        <TableRow
                          key={row.id}
                          ref={rowRef(row.original.id)}
                          className={cn(
                            "h-9 cursor-pointer",
                            row.original.cancelledAt === null ? "" : "opacity-70",
                            rowClassName(row.original.id),
                          )}
                          onClick={() => openSpotlight(row.original.id)}
                        >
                          {compact ? (
                            <>
                              <TableCell className="h-9 w-24 py-1.5 font-mono text-xs tabular-nums">
                                {row.original.code}
                              </TableCell>
                              <TableCell className="h-9 min-w-0 py-1.5">
                                <span
                                  className={cn(
                                    "block truncate font-medium",
                                    row.original.cancelledAt === null ? "" : "line-through",
                                  )}
                                >
                                  {row.original.title}
                                </span>
                              </TableCell>
                              <TableCell className="h-9 w-36 py-1.5 text-xs text-muted-foreground">
                                {row.original.cancelledAt !== null
                                  ? "Cancelled"
                                  : row.original.startsAt === null
                                    ? "Unscheduled"
                                    : relativeLabel(row.original.startsAt)}
                              </TableCell>
                            </>
                          ) : (
                            row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} className="h-9 py-1.5">
                                <table.FlexRender cell={cell} />
                              </TableCell>
                            ))
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableShell>
            </div>
          </div>
        )}
        panel={
          spotlightSession === undefined ? null : (
            <SessionSpotlight
              eventId={eventId}
              timezone={timezone}
              session={spotlightSession}
              onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              onCancel={() => {
                setCancelTarget(spotlightSession);
                setCancelOpen(true);
              }}
              onReinstate={() => {
                setReinstateTarget(spotlightSession);
                setReinstateOpen(true);
              }}
              onDelete={() => void remove(spotlightSession)}
              deleting={deleting}
            />
          )
        }
      />

      <CancelSessionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        eventId={eventId}
        eventName={context.event.name}
        timezone={timezone}
        session={cancelTarget}
        onComplete={() => void refresh()}
      />

      <ReinstateSessionDialog
        open={reinstateOpen}
        onOpenChange={setReinstateOpen}
        eventId={eventId}
        eventName={context.event.name}
        timezone={timezone}
        session={reinstateTarget}
        onComplete={() => void refresh()}
      />
    </main>
  );
}
