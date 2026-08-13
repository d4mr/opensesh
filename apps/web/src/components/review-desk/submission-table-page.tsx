import {
  type CsvColumn,
  type DecisionResult,
  type ReviewDeskList,
  type ReviewDeskListItem,
  type SubmissionDecision,
  type SubmissionStatus,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CheckCircle2Icon,
  Columns3Icon,
  DownloadIcon,
  SearchIcon,
  FileInputIcon,
  SendIcon,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { StatusBadge, statusIcon, statusTextClass } from "@/components/app/status-badge";
import { relativeLabel, Timestamp } from "@/components/app/timestamp";
import { DecisionDialog } from "@/components/review-desk/decision-dialog";
import { SubmissionDetail } from "@/components/review-desk/submission-detail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
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
  TableShell,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRowHighlight } from "@/hooks/use-row-highlight";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { reviewDeskListQuery } from "@/lib/review-desk-queries";
import { selectedMatchingFilter, toggleFilteredSelection } from "@/lib/submission-selection";
import { cn } from "@/lib/utils";
import {
  changeSubmissionStatus,
  exportSubmissionsCsv,
  getReviewDeskList,
  informSubmissions,
} from "@/server-fns/review-desk";

export type SubmissionStatusFilter = "all" | "to_inform" | SubmissionStatus;

const statusTabs: ReadonlyArray<{
  readonly value: SubmissionStatusFilter;
  readonly label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "maybe", label: "Maybe" },
  { value: "to_inform", label: "To inform" },
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
  submitter: "Submitter",
  speakers: "Speakers",
  rating: "Rating",
  reviews: "Reviews",
  source: "Source",
  submitted: "Submitted",
  notified: "Notified",
};

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
  status,
  spotlightId,
  onStatusChange,
  onSpotlightChange,
}: {
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
  const list = useSuspenseQuery(reviewDeskListQuery(eventId));
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
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [informFilter, setInformFilter] = useState<"all" | "accepted" | "declined">("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [acceptanceNote, setAcceptanceNote] = useState("");
  const [declineNote, setDeclineNote] = useState("");
  const [informConfirmOpen, setInformConfirmOpen] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    readonly sent: number;
    readonly total: number;
  }>();
  const decisionSnapshot = useRef<ListResult | undefined>(undefined);
  const { highlightedIds, highlightRows } = useRowHighlight();

  const storageKey = "opensesh-submissions-columns";
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

  useEffect(() => {
    if (status !== "to_inform") {
      setSelectedIds(new Set());
      setSelectedOnly(false);
    }
  }, [status]);

  const data = list.data.ok ? list.data.data : null;
  const pendingMail = (data?.mailStatus.queued ?? 0) + (data?.mailStatus.sending ?? 0);
  useEffect(() => {
    if (sendProgress === undefined) return;
    const sent = Math.max(0, sendProgress.total - Math.min(sendProgress.total, pendingMail));
    if (pendingMail === 0) {
      setSendProgress(undefined);
    } else if (sent !== sendProgress.sent) {
      setSendProgress({ sent, total: sendProgress.total });
    }
  }, [pendingMail, sendProgress]);
  const filtered = useMemo(() => {
    if (data === null) return [];
    const query = search.trim().toLowerCase();
    return data.submissions.filter((submission) => {
      if (
        status === "to_inform"
          ? !(
              (submission.status === "accepted" || submission.status === "declined") &&
              submission.notifiedAt === null
            )
          : status !== "all" && submission.status !== status
      )
        return false;
      if (status === "to_inform" && informFilter !== "all" && submission.status !== informFilter)
        return false;
      if (status === "to_inform" && selectedOnly && !selectedIds.has(submission.id)) return false;
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
  }, [data, format, informFilter, search, selectedIds, selectedOnly, status, tag, track]);

  const setList = useCallback(
    (update: (current: ReviewDeskList) => ReviewDeskList) => {
      queryClient.setQueryData<ListResult>(reviewDeskListQuery(eventId).queryKey, (current) =>
        current?.ok ? { ...current, data: update(current.data) } : current,
      );
    },
    [eventId, queryClient],
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
        await invalidateAfterMutation(queryClient, eventId);
        highlightRows([submission.id]);
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
    [eventId, highlightRows, queryClient, setList],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          enableHiding: false,
          header: () => {
            const selected = selectedMatchingFilter(filtered, selectedIds).length;
            return (
              <Checkbox
                aria-label="Select all filtered submissions"
                checked={
                  filtered.length > 0 && selected === filtered.length
                    ? true
                    : selected > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) =>
                  setSelectedIds((current) =>
                    toggleFilteredSelection(current, filtered, checked === true),
                  )
                }
              />
            );
          },
          cell: ({ row }) => (
            <Checkbox
              aria-label={`Select ${row.original.code}`}
              checked={selectedIds.has(row.original.id)}
              onCheckedChange={(checked) =>
                setSelectedIds((current) => {
                  const next = new Set(current);
                  if (checked === true) next.add(row.original.id);
                  else next.delete(row.original.id);
                  return next;
                })
              }
              onClick={(event) => event.stopPropagation()}
            />
          ),
        }),
        columnHelper.accessor("status", {
          header: "Status",
          cell: ({ row }) => (
            <span className="inline-flex items-center gap-1.5">
              <StatusEditor
                submission={row.original}
                change={directStatusChange}
                decide={openDecision}
              />
              {(row.original.status === "accepted" || row.original.status === "declined") &&
              row.original.notifiedAt === null ? (
                <Badge variant="outline" className="rounded-sm px-1 py-px text-[10px] font-normal">
                  Not informed
                </Badge>
              ) : null}
            </span>
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
        columnHelper.accessor((submission) => submission.submitter?.name ?? "", {
          id: "submitter",
          header: "Submitter",
          cell: ({ row }) =>
            row.original.submitter === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <SpeakerBadge
                person={{
                  id: row.original.submitter.id,
                  name: row.original.submitter.name,
                  image: null,
                }}
              />
            ),
        }),
        columnHelper.accessor(
          (submission) => submission.speakers.map((item) => item.name).join(", "),
          {
            id: "speakers",
            header: "Speakers",
            cell: ({ row }) => (
              <div className="flex gap-2">
                {row.original.speakers.map((speaker) => (
                  <SpeakerBadge
                    key={speaker.id}
                    person={{ id: speaker.id, name: speaker.name, image: speaker.headshotUrl }}
                  />
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
          cell: ({ row }) =>
            row.original.submittedAt === null ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              <Timestamp
                value={row.original.submittedAt}
                timezone={eventTimezone}
                className="text-xs text-muted-foreground"
              >
                {relativeLabel(row.original.submittedAt)}
              </Timestamp>
            ),
        }),
      ]),
    [directStatusChange, eventTimezone, filtered, openDecision, selectedIds],
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
      sorting: state.sorting,
    }),
  );
  const tableRows = table.getRowModel().rows;
  const pages = usePagination(tableRows, {
    resetKey: `${status}:${search}:${track}:${format}:${tag}`,
    spotlightId,
    getId: (row) => row.original.id,
  });

  if (context === null) return null;
  if (!list.data.ok) return <p className="p-6 text-sm">{list.data.error.message}</p>;
  const readyData = list.data.data;

  const counts = new Map<SubmissionStatusFilter, number>([["all", readyData.submissions.length]]);
  for (const submission of readyData.submissions) {
    counts.set(submission.status, (counts.get(submission.status) ?? 0) + 1);
    if (
      (submission.status === "accepted" || submission.status === "declined") &&
      submission.notifiedAt === null
    )
      counts.set("to_inform", (counts.get("to_inform") ?? 0) + 1);
  }
  const selectedRows = selectedMatchingFilter(filtered, selectedIds);
  const decidableRows = selectedRows.filter(
    (row) => row.status !== "draft" && row.status !== "withdrawn",
  );
  const toInform = readyData.submissions.filter(
    (submission) =>
      (submission.status === "accepted" || submission.status === "declined") &&
      submission.notifiedAt === null,
  );
  const acceptanceCount = toInform.filter((submission) => submission.status === "accepted").length;
  const declineCount = toInform.length - acceptanceCount;
  const informAcceptances = selectedRows.filter((row) => row.status === "accepted");
  const informDeclines = selectedRows.filter((row) => row.status === "declined");
  const orderedIds = tableRows.map((row) => row.original.id);
  const exportRows = async (rows: ReadonlyArray<ReviewDeskListItem>) => {
    const columns = table
      .getVisibleLeafColumns()
      .map((column) => column.id)
      .filter(isCsvColumn);
    const response = await exportSubmissionsCsv({
      data: {
        eventId,
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
    anchor.download = "submissions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${rows.length} ${rows.length === 1 ? "row" : "rows"} to submissions.csv`,
    );
  };

  const applyDecisionOptimistic = (nextDecision: SubmissionDecision) => {
    decisionSnapshot.current = queryClient.getQueryData<ListResult>(
      reviewDeskListQuery(eventId).queryKey,
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
    setSelectedIds(new Set());
    void invalidateAfterMutation(queryClient, eventId).then(() =>
      highlightRows(result.submissions.map((submission) => submission.id)),
    );
  };

  const informSelected = async () => {
    const acceptances = informAcceptances;
    const declines = informDeclines;
    if (acceptances.length + declines.length === 0) return;
    setInformConfirmOpen(false);
    let queued = 0;
    const informedIds: Array<string> = [];
    for (const group of [
      { rows: acceptances, feedback: acceptanceNote },
      { rows: declines, feedback: declineNote },
    ]) {
      if (group.rows.length === 0) continue;
      const result = await informSubmissions({
        data: {
          eventId,
          submissionIds: group.rows.map((row) => row.id),
          feedback: group.feedback,
        },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        await invalidateAfterMutation(queryClient, eventId);
        return;
      }
      queued += result.data.queued;
      informedIds.push(...group.rows.map((row) => row.id));
    }
    const informed = new Set(informedIds);
    setList((current) => ({
      ...current,
      submissions: current.submissions.map((submission) =>
        informed.has(submission.id) ? { ...submission, notifiedAt: new Date() } : submission,
      ),
    }));
    setSelectedIds((current) => new Set([...current].filter((id) => !informed.has(id))));
    await invalidateAfterMutation(queryClient, eventId);
    setSendProgress({ sent: 0, total: queued });
    toast.success(`Queued ${queued} decision email${queued === 1 ? "" : "s"}`);
  };

  if (readyData.submissions.length === 0) {
    return (
      <main className="p-4 text-sm lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Submissions</h1>
            <p className="text-sm text-muted-foreground">
              Review and decide CFP submissions for {context.event.name}.
            </p>
          </div>
        </div>
        <AdminEmptyState
          icon={FileInputIcon}
          title="Collect your first submission"
          description="Publish a call for papers before proposals can arrive here."
          action={
            <Button asChild size="sm" className="pressable">
              <Link to="/admin/forms">Create call for papers</Link>
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
        orderedIds={orderedIds}
        highlightedIds={highlightedIds}
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
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">Submissions</h1>
                <p className="text-sm text-muted-foreground">
                  Review and decide CFP submissions for {context.event.name}.
                </p>
              </div>
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
                  const value = tab.value === "all" || tab.value === "to_inform" ? null : tab.value;
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
                {status === "to_inform" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-1.5">
                    <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
                      {[
                        ["all", "All", toInform.length],
                        ["accepted", "Acceptances", acceptanceCount],
                        ["declined", "Declines", declineCount],
                      ].map(([value, label, count]) => (
                        <Button
                          key={String(value)}
                          size="xs"
                          variant={informFilter === value ? "default" : "ghost"}
                          onClick={() =>
                            setInformFilter(
                              value === "accepted" || value === "declined" ? value : "all",
                            )
                          }
                        >
                          {label} ({count})
                        </Button>
                      ))}
                    </div>
                    <Button
                      size="xs"
                      variant={selectedOnly ? "secondary" : "outline"}
                      disabled={selectedIds.size === 0}
                      onClick={() => setSelectedOnly((current) => !current)}
                    >
                      Selected only ({selectedIds.size})
                    </Button>
                    <span className="ml-auto text-xs font-medium tabular-nums">
                      {selectedRows.length} selected
                    </span>
                    <Button
                      size="xs"
                      disabled={selectedRows.length === 0 || sendProgress !== undefined}
                      onClick={() => setInformConfirmOpen(true)}
                    >
                      <SendIcon />
                      {sendProgress === undefined
                        ? `Inform (${selectedRows.length})`
                        : `Sending ${sendProgress.sent}/${sendProgress.total}…`}
                    </Button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1 sm:max-w-sm">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search submissions…"
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

                {status !== "to_inform" && selectedRows.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                    <span className="mr-auto text-xs font-medium tabular-nums">
                      {selectedRows.length} selected
                      {selectedRows.length === decidableRows.length
                        ? ""
                        : " · accepted rows are decided; manage them in Sessions"}
                    </span>
                    <Button
                      size="xs"
                      disabled={decidableRows.length === 0}
                      onClick={() => openDecision(decidableRows, "accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={decidableRows.length === 0}
                      onClick={() => openDecision(decidableRows, "decline")}
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
                          {/* Selection must survive the spotlight: the wave is
                              curated while previewing, so compact keeps the
                              checkbox column on the inform queue. */}
                          {status === "to_inform" ? (
                            <TableHead className="h-8 w-8 text-xs">
                              <Checkbox
                                aria-label="Select all filtered submissions"
                                checked={
                                  filtered.length > 0 && selectedRows.length === filtered.length
                                    ? true
                                    : selectedRows.length > 0
                                      ? "indeterminate"
                                      : false
                                }
                                onCheckedChange={(checked) =>
                                  setSelectedIds((current) =>
                                    toggleFilteredSelection(current, filtered, checked === true),
                                  )
                                }
                              />
                            </TableHead>
                          ) : null}
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
                            {status === "to_inform" && toInform.length === 0
                              ? "Every decision has been sent."
                              : "No submissions match these filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pages.pageItems.map((row) => (
                          <TableRow
                            key={row.id}
                            ref={rowRef(row.original.id)}
                            data-state={selectedIds.has(row.original.id) ? "selected" : undefined}
                            className={cn("h-9 cursor-pointer", rowClassName(row.original.id))}
                            onClick={() => openSpotlight(row.original.id)}
                          >
                            {compact ? (
                              <>
                                {status === "to_inform" ? (
                                  <TableCell
                                    className="h-9 w-8 py-1.5"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      aria-label={`Select ${row.original.code}`}
                                      checked={selectedIds.has(row.original.id)}
                                      onCheckedChange={(checked) =>
                                        setSelectedIds((current) => {
                                          const next = new Set(current);
                                          if (checked === true) next.add(row.original.id);
                                          else next.delete(row.original.id);
                                          return next;
                                        })
                                      }
                                    />
                                  </TableCell>
                                ) : null}
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
                </TableShell>
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
                onStatusChanged={(id) => highlightRows([id])}
                onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
                informPreview={
                  status !== "to_inform"
                    ? undefined
                    : (() => {
                        const focused = readyData.submissions.find(
                          (submission) => submission.id === spotlightId,
                        );
                        if (
                          focused === undefined ||
                          (focused.status !== "accepted" && focused.status !== "declined")
                        )
                          return undefined;
                        const accepted = focused.status === "accepted";
                        return {
                          note: accepted ? acceptanceNote : declineNote,
                          count: selectedRows.filter((row) => row.status === focused.status).length,
                          onNoteChange: accepted ? setAcceptanceNote : setDeclineNote,
                        };
                      })()
                }
              />
            </Suspense>
          )
        }
      />

      {/* Mounted on demand like every confirm in the app; the wave was already
          reviewed in the spotlight, so this only restates the split. */}
      {informConfirmOpen ? (
        <Dialog open onOpenChange={setInformConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Send decision emails</DialogTitle>
              <DialogDescription>
                {[
                  informAcceptances.length > 0
                    ? `${informAcceptances.length} acceptance${informAcceptances.length === 1 ? "" : "s"}`
                    : null,
                  informDeclines.length > 0
                    ? `${informDeclines.length} decline${informDeclines.length === 1 ? "" : "s"}`
                    : null,
                ]
                  .filter((part) => part !== null)
                  .join(" and ")}{" "}
                will be emailed to{" "}
                {informAcceptances.length + informDeclines.length === 1
                  ? "its submitter"
                  : "their submitters"}{" "}
                and marked notified.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setInformConfirmOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void informSelected()}>
                <SendIcon /> Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <DecisionDialog
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        eventId={eventId}
        eventName={context.event.name}
        confirmationRequested={context.event.speakerConfirmationEnabled}
        submissions={decisionTargets}
        initialDecision={decision}
        onOptimistic={applyDecisionOptimistic}
        onFailure={() => {
          if (decisionSnapshot.current !== undefined) {
            queryClient.setQueryData(
              reviewDeskListQuery(eventId).queryKey,
              decisionSnapshot.current,
            );
          }
        }}
        onComplete={completeDecision}
      />
    </main>
  );
}
