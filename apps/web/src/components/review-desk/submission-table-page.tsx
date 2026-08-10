import {
  type CsvColumn,
  type DecisionResult,
  type ReviewDeskList,
  type ReviewDeskListItem,
  type SubmissionDecision,
  type SubmissionStatus,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CheckCircle2Icon,
  Columns3Icon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { StatusBadge, statusIcon, statusTextClass } from "@/components/app/status-badge";
import { DecisionDialog } from "@/components/review-desk/decision-dialog";
import { SubmissionDetail } from "@/components/review-desk/submission-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reviewDeskListQuery } from "@/lib/review-desk-queries";
import { cn } from "@/lib/utils";
import {
  changeSubmissionStatus,
  exportSubmissionsCsv,
  getReviewDeskList,
} from "@/server-fns/review-desk";

export type SubmissionStatusFilter = "all" | SubmissionStatus;

const statusTabs: ReadonlyArray<{
  readonly value: SubmissionStatusFilter;
  readonly label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "maybe", label: "Maybe" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "draft", label: "Drafts" },
];

const editableStatuses: ReadonlyArray<Exclude<SubmissionStatus, "draft">> = [
  "pending",
  "maybe",
  "accepted",
  "declined",
  "withdrawn",
];

const csvColumns: ReadonlySet<string> = new Set([
  "status",
  "code",
  "title",
  "tracks",
  "format",
  "speakers",
  "rating",
  "reviews",
  "source",
  "submitted",
  "notified",
]);

const isCsvColumn = (value: string): value is CsvColumn => csvColumns.has(value);

const columnLabels: Readonly<Record<string, string>> = {
  status: "Status",
  code: "Code",
  title: "Title",
  tracks: "Tracks",
  format: "Format",
  speakers: "Speakers",
  rating: "Rating",
  reviews: "Reviews",
  source: "Source",
  submitted: "Submitted",
  notified: "Notified",
};

// Pinned to the event timezone so SSR (UTC worker) and the client render
// identical title text — an unpinned formatter hydration-mismatches.
const absoluteDate = (timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });

const relativeDate = (date: Date | null) => {
  if (date === null) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
};

const features = tableFeatures({
  rowSelectionFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
const columnHelper = createColumnHelper<typeof features, ReviewDeskListItem>();
type ListResult = Awaited<ReturnType<typeof getReviewDeskList>>;

function TrackChips({ submission }: { readonly submission: ReviewDeskListItem }) {
  return (
    <div className="flex gap-1">
      {submission.tracks.map((track) => (
        <span
          key={track.id}
          className="rounded-md border px-1.5 py-0.5 text-xs font-medium"
          style={{
            borderColor: track.color,
            color: track.color,
            backgroundColor: `color-mix(in srgb, ${track.color} 9%, transparent)`,
          }}
        >
          {track.name}
        </span>
      ))}
    </div>
  );
}

function StatusEditor({
  submission,
  change,
  decide,
}: {
  readonly submission: ReviewDeskListItem;
  readonly change: (submission: ReviewDeskListItem, status: SubmissionStatus) => void;
  readonly decide: (
    submissions: ReadonlyArray<ReviewDeskListItem>,
    decision: SubmissionDecision,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => event.stopPropagation()}
        >
          <StatusBadge status={submission.status} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 p-1"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Status</p>
        {editableStatuses.map((status) => (
          <button
            key={status}
            type="button"
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            onClick={() => {
              setOpen(false);
              if (status === "accepted" || status === "declined") {
                decide([submission], status === "accepted" ? "accept" : "decline");
              } else {
                change(submission, status);
              }
            }}
          >
            <StatusBadge status={status} />
            {submission.status === status ? <CheckIcon className="size-3.5" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function SubmissionTablePage({
  kind,
  status,
  spotlightId,
  onStatusChange,
  onSpotlightChange,
}: {
  readonly kind: "abstract" | "session";
  readonly status: SubmissionStatusFilter;
  readonly spotlightId: string | undefined;
  readonly onStatusChange: (status: SubmissionStatusFilter) => void;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const eventTimezone = context?.event.timezone ?? "UTC";
  const list = useSuspenseQuery(reviewDeskListQuery(eventId, kind));
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("all");
  const [format, setFormat] = useState("all");
  const [tag, setTag] = useState("all");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [visibilityReady, setVisibilityReady] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<SubmissionDecision>("accept");
  const [decisionTargets, setDecisionTargets] = useState<ReadonlyArray<ReviewDeskListItem>>([]);
  const decisionSnapshot = useRef<ListResult | undefined>(undefined);

  const storageKey = `opensesh-${kind}-columns`;
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved !== null) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed === "object" && parsed !== null) {
          const visible = Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
            ),
          );
          setColumnVisibility(visible);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setVisibilityReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (visibilityReady) window.localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey, visibilityReady]);

  const data = list.data.ok ? list.data.data : null;
  const filtered = useMemo(() => {
    if (data === null) return [];
    const query = search.trim().toLowerCase();
    return data.submissions.filter((submission) => {
      if (status !== "all" && submission.status !== status) return false;
      if (track !== "all" && !submission.tracks.some((item) => item.id === track)) return false;
      if (format !== "all" && submission.format !== format) return false;
      if (tag !== "all" && !submission.tags.some((item) => item.id === tag)) return false;
      if (query.length === 0) return true;
      return [
        submission.title,
        submission.code,
        ...submission.speakers.flatMap((speaker) => [speaker.name, speaker.email]),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [data, format, search, status, tag, track]);

  const setList = useCallback(
    (update: (current: ReviewDeskList) => ReviewDeskList) => {
      queryClient.setQueryData<ListResult>(
        reviewDeskListQuery(eventId, kind).queryKey,
        (current) => (current?.ok ? { ...current, data: update(current.data) } : current),
      );
    },
    [eventId, kind, queryClient],
  );

  const openDecision = useCallback(
    (submissions: ReadonlyArray<ReviewDeskListItem>, nextDecision: SubmissionDecision) => {
      setDecisionTargets(submissions);
      setDecision(nextDecision);
      setDecisionOpen(true);
    },
    [],
  );

  const directStatusChange = useCallback(
    (submission: ReviewDeskListItem, nextStatus: SubmissionStatus) => {
      const previousStatus = submission.status;
      const apply = (next: SubmissionStatus) =>
        setList((current) => ({
          ...current,
          submissions: current.submissions.map((item) =>
            item.id === submission.id ? { ...item, status: next } : item,
          ),
        }));
      const save = async (next: SubmissionStatus, rollback: SubmissionStatus) => {
        apply(next);
        const result = await changeSubmissionStatus({
          data: { eventId, submissionId: submission.id, status: next },
        });
        if (!result.ok) {
          apply(rollback);
          toast.error(result.error.message);
          return false;
        }
        void queryClient.invalidateQueries({
          queryKey: ["review-desk-detail", eventId, submission.id],
        });
        return true;
      };
      void save(nextStatus, previousStatus).then((saved) => {
        if (!saved) return;
        toast(`Marked ${submission.code} ${nextStatus}`, {
          action: {
            label: "Undo",
            onClick: () => void save(previousStatus, nextStatus),
          },
        });
      });
    },
    [eventId, queryClient, setList],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          enableHiding: false,
          header: ({ table }) => (
            <Checkbox
              aria-label="Select all visible submissions"
              checked={
                table.getIsAllRowsSelected()
                  ? true
                  : table.getIsSomeRowsSelected()
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label={`Select ${row.original.code}`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
              onClick={(event) => event.stopPropagation()}
            />
          ),
        }),
        columnHelper.accessor("status", {
          header: "Status",
          cell: ({ row }) => (
            <StatusEditor
              submission={row.original}
              change={directStatusChange}
              decide={openDecision}
            />
          ),
        }),
        columnHelper.accessor("notifiedAt", {
          id: "notified",
          header: "Notified",
          cell: ({ row }) =>
            row.original.notifiedAt === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2Icon className="size-3.5 text-status-accepted" /> Sent
              </span>
            ),
        }),
        columnHelper.accessor("code", {
          header: "Code",
          cell: ({ row }) => (
            <span className="font-mono text-xs tabular-nums">{row.original.code}</span>
          ),
        }),
        columnHelper.accessor("title", {
          header: "Title",
          cell: ({ row }) => (
            <span className="block max-w-80 truncate font-medium">{row.original.title}</span>
          ),
        }),
        columnHelper.accessor(
          (submission) => submission.tracks.map((item) => item.name).join(", "),
          {
            id: "tracks",
            header: "Tracks",
            enableSorting: false,
            cell: ({ row }) => <TrackChips submission={row.original} />,
          },
        ),
        columnHelper.accessor("format", {
          header: "Format",
          cell: ({ row }) =>
            row.original.format ?? <span className="text-muted-foreground">—</span>,
        }),
        columnHelper.accessor(
          (submission) => submission.speakers.map((item) => item.name).join(", "),
          {
            id: "speakers",
            header: "Speakers",
            cell: ({ row }) => (
              <div className="flex gap-1">
                {row.original.speakers.map((speaker) => (
                  <Badge key={speaker.id} variant="secondary" className="rounded-md">
                    {speaker.name}
                  </Badge>
                ))}
              </div>
            ),
          },
        ),
        columnHelper.accessor("rating", {
          header: "Rating",
          sortUndefined: "last",
          cell: ({ row }) =>
            row.original.rating === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              row.original.rating.toFixed(1)
            ),
        }),
        columnHelper.accessor("reviewCount", {
          id: "reviews",
          header: "Reviews",
        }),
        columnHelper.accessor("source", { header: "Source" }),
        columnHelper.accessor("submittedAt", {
          id: "submitted",
          header: "Submitted",
          sortDescFirst: true,
          cell: ({ row }) => (
            <span
              className="text-xs text-muted-foreground"
              title={
                row.original.submittedAt === null
                  ? undefined
                  : absoluteDate(eventTimezone).format(row.original.submittedAt)
              }
            >
              {relativeDate(row.original.submittedAt)}
            </span>
          ),
        }),
      ]),
    [directStatusChange, openDecision, eventTimezone],
  );

  const table = useTable(
    {
      features,
      columns,
      data: filtered,
      getRowId: (row) => row.id,
      enableSortingRemoval: false,
      initialState: { sorting: [{ id: "submitted", desc: true }] },
      state: { columnVisibility },
      onColumnVisibilityChange: setColumnVisibility,
    },
    (state) => ({
      columnVisibility: state.columnVisibility,
      rowSelection: state.rowSelection,
      sorting: state.sorting,
    }),
  );

  if (context === null) return null;
  if (!list.data.ok) return <p className="p-6 text-sm">{list.data.error.message}</p>;
  const readyData = list.data.data;

  const counts = new Map<SubmissionStatusFilter, number>([["all", readyData.submissions.length]]);
  for (const submission of readyData.submissions) {
    counts.set(submission.status, (counts.get(submission.status) ?? 0) + 1);
  }
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const orderedIds = table.getRowModel().rows.map((row) => row.original.id);
  const exportRows = async (rows: ReadonlyArray<ReviewDeskListItem>) => {
    const columns = table
      .getVisibleLeafColumns()
      .map((column) => column.id)
      .filter(isCsvColumn);
    const response = await exportSubmissionsCsv({
      data: {
        eventId,
        kind,
        submissionIds: rows.map((row) => row.id),
        columns,
      },
    });
    if (!response.ok) {
      toast.error(await response.text());
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kind}s.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const applyDecisionOptimistic = (nextDecision: SubmissionDecision) => {
    decisionSnapshot.current = queryClient.getQueryData<ListResult>(
      reviewDeskListQuery(eventId, kind).queryKey,
    );
    const ids = new Set(decisionTargets.map((submission) => submission.id));
    const nextStatus = nextDecision === "accept" ? "accepted" : "declined";
    setList((current) => ({
      ...current,
      submissions: current.submissions.map((submission) =>
        ids.has(submission.id) ? { ...submission, status: nextStatus } : submission,
      ),
    }));
  };

  const completeDecision = (result: DecisionResult) => {
    const updated = new Map(result.submissions.map((submission) => [submission.id, submission]));
    setList((current) => ({
      ...current,
      submissions: current.submissions.map((submission) => {
        const next = updated.get(submission.id);
        return next === undefined
          ? submission
          : { ...submission, status: next.status, notifiedAt: next.notifiedAt };
      }),
    }));
    table.resetRowSelection(true);
    void queryClient.invalidateQueries({ queryKey: ["review-desk-detail", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["evaluation-queue", eventId] });
    // Acceptance graduates abstracts to kind='session' — refresh the other desk.
    void queryClient.invalidateQueries({
      queryKey: reviewDeskListQuery(eventId, kind === "abstract" ? "session" : "abstract").queryKey,
    });
  };

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={orderedIds}
        onSpotlightChange={onSpotlightChange}
        clearFilters={() => {
          setSearch("");
          setTrack("all");
          setFormat("all");
          setTag("all");
          onStatusChange("all");
        }}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col p-4 lg:p-6">
            <div className="mb-4">
              <h1 className="text-lg font-semibold">
                {kind === "abstract" ? "Submissions" : "Sessions"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Review and manage {kind} submissions for {context.event.name}.
              </p>
            </div>

            <Tabs
              value={status}
              className="flex min-h-0 flex-1 flex-col"
              onValueChange={(value) => {
                const next = statusTabs.find((tab) => tab.value === value);
                if (next !== undefined) onStatusChange(next.value);
              }}
            >
              <TabsList
                variant="line"
                className="max-w-full justify-start overflow-x-auto border-b pb-1"
              >
                {statusTabs.map((tab) => {
                  const value = tab.value === "all" ? null : tab.value;
                  const Icon = value === null ? null : statusIcon[value];
                  return (
                    <TabsTrigger key={tab.value} value={tab.value} className="flex-none text-xs">
                      {Icon === null || value === null ? null : (
                        <Icon className={cn("size-3.5", statusTextClass[value])} />
                      )}
                      {tab.label}
                      <span
                        className={cn(
                          "tabular-nums",
                          value === null ? "text-muted-foreground" : statusTextClass[value],
                        )}
                      >
                        {counts.get(tab.value) ?? 0}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <TabsContent value={status} className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1 sm:max-w-sm">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={`Search ${kind}s…`}
                      className="h-8 pl-8"
                    />
                  </div>
                  <Select
                    value={track}
                    onValueChange={(value) => value !== null && setTrack(value)}
                  >
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
                  <Select value={tag} onValueChange={(value) => value !== null && setTag(value)}>
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {readyData.tags.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {search === "" && track === "all" && format === "all" && tag === "all" ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setSearch("");
                        setTrack("all");
                        setFormat("all");
                        setTag("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Columns3Icon /> Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {table
                        .getAllLeafColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={column.getIsVisible()}
                            onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {columnLabels[column.id] ?? column.id}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void exportRows(table.getRowModel().rows.map((row) => row.original))
                    }
                  >
                    <DownloadIcon /> Export CSV
                  </Button>
                </div>

                {selectedRows.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                    <span className="mr-auto text-xs font-medium tabular-nums">
                      {selectedRows.length} selected
                    </span>
                    <Button size="xs" onClick={() => openDecision(selectedRows, "accept")}>
                      Accept
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => openDecision(selectedRows, "decline")}
                    >
                      Decline
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => void exportRows(selectedRows)}
                    >
                      Export selection
                    </Button>
                  </div>
                ) : null}

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                      {compact ? (
                        <TableRow className="h-8 hover:bg-transparent">
                          <TableHead className="h-8 w-28 text-xs">Status</TableHead>
                          <TableHead className="h-8 w-24 text-xs">Code</TableHead>
                          <TableHead className="h-8 text-xs">Title</TableHead>
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
                      {table.getRowModel().rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={table.getVisibleLeafColumns().length}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No submissions match these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            ref={rowRef(row.original.id)}
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            className={cn("h-9 cursor-pointer", rowClassName(row.original.id))}
                            onClick={() => openSpotlight(row.original.id)}
                          >
                            {compact ? (
                              <>
                                <TableCell className="h-9 w-28 py-1.5">
                                  <StatusBadge status={row.original.status} />
                                </TableCell>
                                <TableCell className="h-9 w-24 py-1.5 font-mono text-xs tabular-nums">
                                  {row.original.code}
                                </TableCell>
                                <TableCell className="h-9 min-w-0 py-1.5">
                                  <span className="block truncate font-medium">
                                    {row.original.title}
                                  </span>
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
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {table.getRowModel().rows.length} of {readyData.submissions.length} rows
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}
        panel={
          spotlightId === undefined ? null : (
            <Suspense
              fallback={
                <div className="flex h-full min-h-0 flex-col">
                  <SpotlightPanelHeader
                    identity={
                      <span className="text-xs text-muted-foreground">Loading submission…</span>
                    }
                    onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
                  />
                </div>
              }
            >
              <SubmissionDetail
                id={spotlightId}
                variant="spotlight"
                onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              />
            </Suspense>
          )
        }
      />

      <DecisionDialog
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        eventId={eventId}
        eventName={context.event.name}
        submissions={decisionTargets}
        initialDecision={decision}
        onOptimistic={applyDecisionOptimistic}
        onFailure={() => {
          if (decisionSnapshot.current !== undefined) {
            queryClient.setQueryData(
              reviewDeskListQuery(eventId, kind).queryKey,
              decisionSnapshot.current,
            );
          }
        }}
        onComplete={completeDecision}
      />
    </main>
  );
}
