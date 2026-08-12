import {
  hasRichText,
  type SpeakerDirectoryRow,
  type SpeakerWorkflowStatus,
} from "@opensesh/domain";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  CopyIcon,
  DownloadIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UploadIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { RichText } from "@/components/forms/rich-text";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { ChangeDiff } from "@/components/app/change-diff";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { StatusBadge } from "@/components/app/status-badge";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import { TaskTemplateDialog } from "@/components/admin/portal-admin";
import {
  CsvImportDialog,
  PortalInviteResultDialog,
  SpeakerFormDialog,
  WorkflowBadge,
  workflowLabels,
} from "@/components/admin/speaker-admin-dialogs";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { qk } from "@/lib/query-keys";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { describeChangedFields, profileDiffRows } from "@/lib/content-diff";
import { dataUrlForVersion, downloadVersion, fileAsBase64 } from "@/lib/files";
import { adminPortalQuery } from "@/lib/portal-queries";
import { cn } from "@/lib/utils";
import { speakerDirectoryQuery } from "@/lib/widget-queries";
import {
  approveProfileChange,
  rejectProfileChange,
  updateAdminSpeakerProfile,
  uploadAdminHeadshot,
  waiveAdminAssignment,
} from "@/server-fns/portal";
import { inviteSpeakerPortals, setSpeakerWorkflowStatus } from "@/server-fns/speaker-comms";

const dietaryLabels: Readonly<Record<string, string>> = {
  none: "—",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  other: "Other",
};

const emailTypeLabels: Readonly<Record<SpeakerDirectoryRow["emails"][number]["type"], string>> = {
  confirmation: "Confirmation",
  magic_link: "Magic link",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  reinstated: "Reinstated",
  task_reminder: "Task reminder",
  calendar_invite: "Calendar invite",
  custom: "Custom",
};

const taskStatusLabels: Readonly<Record<SpeakerDirectoryRow["tasks"][number]["status"], string>> = {
  todo: "Open",
  done: "Done",
  waived: "Waived",
};

const readinessToneClass: Readonly<Record<"accepted" | "pending" | "declined", string>> = {
  accepted: "bg-[var(--status-accepted)]",
  pending: "bg-[var(--status-pending)]",
  declined: "bg-[var(--status-declined)]",
};

// Pinned to the event timezone so SSR (UTC worker) and the client render
// identical text — an unpinned formatter hydration-mismatches.
const shortDate = (value: Date, timezone: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: timezone }).format(
    new Date(value),
  );

function ReadinessLine({
  label,
  detail,
  tone,
}: {
  readonly label: string;
  readonly detail: string;
  readonly tone: "accepted" | "pending" | "declined";
}) {
  return (
    <div className="flex h-8 items-center gap-2 px-3">
      <span className={cn("size-1.5 shrink-0 rounded-full", readinessToneClass[tone])} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-muted-foreground">{detail}</span>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: string }) {
  return <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>;
}

function SessionReadinessBadge({
  session,
}: {
  readonly session: SpeakerDirectoryRow["sessions"][number];
}) {
  if (session.cancelledAt !== null) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <CircleSlashIcon className="size-3" /> Cancelled
      </span>
    );
  }
  if (session.startsAt === null) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--status-pending-border)] bg-[var(--status-pending-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-pending)]">
        <CircleDashedIcon className="size-3" /> Unscheduled
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--status-accepted-border)] bg-[var(--status-accepted-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-accepted)]">
      <CheckIcon className="size-3" /> Scheduled
    </span>
  );
}

export function SpeakersDirectory({
  spotlightId,
  onSpotlightChange,
}: {
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const context = useAdminEvent();
  if (context === null) return null;
  return (
    <DirectoryData
      eventId={context.event.id}
      timezone={context.event.timezone}
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function DirectoryData({
  eventId,
  timezone,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const result = useSuspenseQuery(speakerDirectoryQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return (
    <Directory
      eventId={eventId}
      timezone={timezone}
      rows={result.data.data.rows}
      csv={result.data.data.csv}
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function Directory({
  eventId,
  timezone,
  rows,
  csv,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly rows: ReadonlyArray<SpeakerDirectoryRow>;
  readonly csv: string;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SpeakerDirectoryRow>();
  const [statusFilter, setStatusFilter] = useState<"all" | SpeakerWorkflowStatus>("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [statusOverrides, setStatusOverrides] = useState<
    ReadonlyMap<string, SpeakerWorkflowStatus>
  >(new Map());
  const [inviteResults, setInviteResults] = useState<
    ReadonlyArray<{
      readonly contactId: string;
      readonly contactName: string;
      readonly portalPath: string;
      readonly alreadyInvited: boolean;
    }>
  >([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string>();
  const [waivedIds, setWaivedIds] = useState<ReadonlySet<string>>(new Set());
  const [peekTaskId, setPeekTaskId] = useState<string>();
  const [editingTaskTemplateId, setEditingTaskTemplateId] = useState<string>();
  const [profileDecisions, setProfileDecisions] = useState<
    ReadonlyMap<string, "approve" | "reject">
  >(new Map());
  const queryClient = useQueryClient();
  const portal = useQuery(adminPortalQuery(eventId));
  // Deliberately unscoped: speaker edits write to shared org contacts, which
  // other events' rosters read — every event subtree must go stale.
  const refresh = () => invalidateAfterMutation(queryClient);
  const waive = useMutation({
    mutationFn: (assignmentId: string) => waiveAdminAssignment({ data: { eventId, assignmentId } }),
    onMutate: (assignmentId) => setWaivedIds((current) => new Set([...current, assignmentId])),
    onSuccess: async (result, assignmentId) => {
      if (!result.ok) {
        setWaivedIds((current) => {
          const next = new Set(current);
          next.delete(assignmentId);
          return next;
        });
        toast.error(result.error.message);
        return;
      }
      toast.success("Task waived");
      await refresh();
    },
    onError: (_error, assignmentId) =>
      setWaivedIds((current) => {
        const next = new Set(current);
        next.delete(assignmentId);
        return next;
      }),
  });
  const reviewProfile = useMutation({
    mutationFn: ({
      historyId,
      decision,
    }: {
      readonly historyId: string;
      readonly decision: "approve" | "reject";
    }) =>
      decision === "approve"
        ? approveProfileChange({ data: { eventId, historyId } })
        : rejectProfileChange({ data: { eventId, historyId } }),
    onMutate: ({ historyId, decision }) =>
      setProfileDecisions((current) => new Map(current).set(historyId, decision)),
    onSuccess: async (result, { historyId }) => {
      if (!result.ok) {
        setProfileDecisions((current) => {
          const next = new Map(current);
          next.delete(historyId);
          return next;
        });
        toast.error(result.error.message);
        return;
      }
      toast.success("Profile review updated");
      await refresh();
    },
    onError: (_error, { historyId }) =>
      setProfileDecisions((current) => {
        const next = new Map(current);
        next.delete(historyId);
        return next;
      }),
  });
  const workflow = useMutation({
    mutationFn: ({
      contactId,
      workflowStatus,
    }: {
      readonly contactId: string;
      readonly workflowStatus: SpeakerWorkflowStatus;
    }) => setSpeakerWorkflowStatus({ data: { eventId, contactId, workflowStatus } }),
    onMutate: ({ contactId, workflowStatus }) =>
      setStatusOverrides((current) => new Map(current).set(contactId, workflowStatus)),
    onSuccess: async (result, { contactId }) => {
      if (!result.ok) {
        setStatusOverrides((current) => {
          const next = new Map(current);
          next.delete(contactId);
          return next;
        });
        toast.error(result.error.message);
        return;
      }
      toast.success("Speaker status saved");
      await refresh();
    },
  });
  const invite = useMutation({
    mutationFn: (contactIds: ReadonlyArray<string>) =>
      inviteSpeakerPortals({ data: { eventId, contactIds } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setInviteResults(result.data.invitations);
      setInviteOpen(true);
      setSelectedIds(new Set());
      toast.success(`Sent ${result.data.sent} invitation${result.data.sent === 1 ? "" : "s"}`);
      await refresh();
    },
  });
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch = [
          row.contact.firstName,
          row.contact.lastName,
          row.contact.email,
          row.contact.title ?? "",
          row.contact.company ?? "",
          ...row.sessions.map((session) => session.title),
          ...row.otherSubmissions.map((submission) => submission.title),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        const status = statusOverrides.get(row.contact.id) ?? row.contact.workflowStatus;
        const todo = row.tasks.filter((task) => task.status === "todo").length;
        const matchesTasks =
          taskFilter === "all" ||
          (taskFilter === "complete" ? row.tasks.length > 0 && todo === 0 : todo > 0);
        return matchesSearch && (statusFilter === "all" || status === statusFilter) && matchesTasks;
      }),
    [rows, search, statusFilter, statusOverrides, taskFilter],
  );
  const selected = rows.find((row) => row.contact.id === spotlightId);
  const portalData = portal.data?.ok ? portal.data.data : undefined;
  const peekTask = selected?.tasks.find((task) => task.id === peekTaskId);
  const peekAssignment = portalData?.assignments.find((row) => row.assignment.id === peekTaskId);
  const pages = usePagination(filtered, {
    resetKey: `${search}:${statusFilter}:${taskFilter}`,
    spotlightId,
    getId: (row) => row.contact.id,
  });
  const activeFilters = search.trim() !== "" || statusFilter !== "all" || taskFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTaskFilter("all");
  };
  const selectedVisible = filtered.filter((row) => selectedIds.has(row.contact.id)).length;
  const allVisibleSelected = filtered.length > 0 && selectedVisible === filtered.length;
  const pendingProfile = selected?.profileChanges.find(
    (entry) => entry.approvalStatus === "pending_review" && !profileDecisions.has(entry.id),
  );
  const reviewedProfile = selected?.profileChanges.find(
    (entry) => entry.approvalStatus === "pending_review" && profileDecisions.has(entry.id),
  );
  const profileDecision =
    reviewedProfile === undefined ? undefined : profileDecisions.get(reviewedProfile.id);
  const effectiveProfileStatus =
    profileDecision === "approve"
      ? "approved"
      : profileDecision === "reject"
        ? "rejected"
        : selected?.contact.profileReviewStatus;
  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
  };
  const downloadFile = async (versionId: string) => {
    const result = await downloadVersion(versionId);
    if (result !== undefined && !result.ok) toast.error(result.error.message);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "speakers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={filtered.map((row) => row.contact.id)}
        onSpotlightChange={onSpotlightChange}
        clearFilters={clearFilters}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">Speakers</h1>
                <p className="text-xs text-muted-foreground">
                  The event directory, profile readiness, and session links.
                </p>
              </div>
              <div className="flex gap-2">
                {selectedIds.size > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="pressable"
                    disabled={invite.isPending}
                    onClick={() => invite.mutate([...selectedIds])}
                  >
                    <SendIcon /> Invite {selectedIds.size}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="pressable" onClick={download}>
                  <DownloadIcon /> Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="pressable"
                  onClick={() => setImportOpen(true)}
                >
                  <UploadIcon /> Import CSV
                </Button>
                <Button
                  size="sm"
                  className="pressable"
                  onClick={() => {
                    setEditing(undefined);
                    setFormOpen(true);
                  }}
                >
                  <PlusIcon /> Add speaker
                </Button>
              </div>
            </div>
            {rows.length === 0 ? (
              <AdminEmptyState
                icon={PlusIcon}
                title="Add your first speaker"
                description="Create a speaker profile now, or import a CSV when your roster is ready."
                action={
                  <Button
                    size="sm"
                    className="pressable"
                    onClick={() => {
                      setEditing(undefined);
                      setFormOpen(true);
                    }}
                  >
                    <PlusIcon /> Add speaker
                  </Button>
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-56 flex-1 sm:max-w-sm">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search speakers…"
                      className="h-8 pl-8"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(
                        value === "invited" ||
                          value === "onboarding" ||
                          value === "confirmed" ||
                          value === "ready" ||
                          value === "declined"
                          ? value
                          : "all",
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {Object.entries(workflowLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={taskFilter}
                    onValueChange={(value) =>
                      setTaskFilter(value === "complete" || value === "incomplete" ? value : "all")
                    }
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tasks</SelectItem>
                      <SelectItem value="complete">Tasks complete</SelectItem>
                      <SelectItem value="incomplete">Tasks incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                  {activeFilters ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="pressable h-8"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                  <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {filtered.length} of {rows.length} speaker{rows.length === 1 ? "" : "s"}
                  </p>
                </div>
                <TableShell
                  scrollRef={scrollRef}
                  footer={
                    <PaginationFooter
                      page={pages.page}
                      pageSize={pages.pageSize}
                      total={filtered.length}
                      onPageChange={pages.setPage}
                    />
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-9">
                          <Checkbox
                            checked={allVisibleSelected}
                            aria-label="Select all visible speakers"
                            onCheckedChange={(checked) =>
                              setSelectedIds(
                                checked === true
                                  ? new Set(filtered.map((row) => row.contact.id))
                                  : new Set(),
                              )
                            }
                          />
                        </TableHead>
                        <TableHead>Speaker</TableHead>
                        {compact ? null : <TableHead>Role</TableHead>}
                        {compact ? null : <TableHead>Profile readiness</TableHead>}
                        {compact ? null : <TableHead>Workflow</TableHead>}
                        {compact ? null : <TableHead>Task progress</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={compact ? 2 : 6}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            No speakers match.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pages.pageItems.map((row) => (
                          <TableRow
                            key={row.contact.id}
                            ref={rowRef(row.contact.id)}
                            className={cn("h-9 cursor-pointer", rowClassName(row.contact.id))}
                            onClick={() => openSpotlight(row.contact.id)}
                          >
                            <TableCell
                              className="h-9 py-0"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedIds.has(row.contact.id)}
                                aria-label={`Select ${row.contact.firstName} ${row.contact.lastName}`}
                                onCheckedChange={(checked) =>
                                  setSelectedIds((current) => {
                                    const next = new Set(current);
                                    if (checked === true) next.add(row.contact.id);
                                    else next.delete(row.contact.id);
                                    return next;
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="h-9 py-0">
                              <div className="flex items-center gap-2.5">
                                <Headshot row={row} />
                                <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                                  {row.contact.firstName} {row.contact.lastName}
                                  {row.contact.profileReviewStatus === "pending_review" ? (
                                    <span className="rounded-sm border px-1 py-px text-[10px] font-normal text-[var(--status-pending)]">
                                      Profile pending
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </TableCell>
                            {compact ? null : (
                              <TableCell className="h-9 max-w-52 py-0">
                                <p className="truncate text-xs text-muted-foreground">
                                  {[row.contact.title, row.contact.company]
                                    .filter(Boolean)
                                    .join(" · ") || row.contact.email}
                                </p>
                              </TableCell>
                            )}
                            {compact ? null : (
                              <TableCell className="h-9 py-0 text-xs">
                                <ProfileReadiness row={row} />
                              </TableCell>
                            )}
                            {compact ? null : (
                              <TableCell className="h-9 py-0 text-xs">
                                <WorkflowBadge
                                  status={
                                    statusOverrides.get(row.contact.id) ??
                                    row.contact.workflowStatus
                                  }
                                />
                              </TableCell>
                            )}
                            {compact ? null : (
                              <TableCell className="h-9 py-0 text-xs tabular-nums text-muted-foreground">
                                {row.tasks.filter((task) => task.status !== "todo").length}/
                                {row.tasks.length} done
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableShell>
              </>
            )}
          </div>
        )}
        panel={
          selected === undefined ? null : (
            <div className="flex h-full min-h-0 flex-col">
              <SpotlightPanelHeader
                identity={
                  <div className="flex min-w-0 items-center gap-2">
                    <Headshot row={selected} />
                    <span className="truncate text-sm font-medium">
                      {selected.contact.firstName} {selected.contact.lastName}
                    </span>
                  </div>
                }
                status={
                  effectiveProfileStatus === "pending_review" ? (
                    <span className="rounded-sm border px-1 py-px text-[10px] font-normal text-[var(--status-pending)]">
                      Profile pending
                    </span>
                  ) : undefined
                }
                actions={
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="pressable"
                      onClick={() => {
                        setEditing(selected);
                        setFormOpen(true);
                      }}
                    >
                      <PencilIcon /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="pressable"
                      disabled={invite.isPending}
                      onClick={() => invite.mutate([selected.contact.id])}
                    >
                      <SendIcon /> Invite
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="pressable"
                      aria-label={`Copy ${selected.contact.email}`}
                      title={copiedEmail === selected.contact.email ? "Email copied" : "Copy email"}
                      onClick={() => void copyEmail(selected.contact.email)}
                    >
                      {copiedEmail === selected.contact.email ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </div>
                }
                onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-16 text-xs">
                <p className="mb-4 text-muted-foreground">
                  {[selected.contact.title, selected.contact.company].filter(Boolean).join(" · ") ||
                    selected.contact.email}
                </p>
                <div className="grid gap-5 [&>section]:min-w-0">
                  {pendingProfile === undefined ? null : (
                    <section>
                      <div className="flex items-center justify-between gap-2">
                        <SectionLabel>Awaiting your review</SectionLabel>
                        <Timestamp
                          value={pendingProfile.createdAt}
                          timezone={timezone}
                          className="text-[11px] text-muted-foreground tabular-nums"
                        >
                          {shortDate(pendingProfile.createdAt, timezone)}
                        </Timestamp>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {selected.contact.firstName} changed{" "}
                        {describeChangedFields(pendingProfile.changedFields)} from the portal. The
                        approved profile stays public until you decide.
                      </p>
                      <ChangeDiff
                        rows={profileDiffRows(pendingProfile)}
                        className="mt-2 rounded-lg border px-3 py-2"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="pressable"
                          disabled={reviewProfile.isPending}
                          onClick={() =>
                            reviewProfile.mutate({
                              historyId: pendingProfile.id,
                              decision: "reject",
                            })
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          className="pressable"
                          disabled={reviewProfile.isPending}
                          onClick={() =>
                            reviewProfile.mutate({
                              historyId: pendingProfile.id,
                              decision: "approve",
                            })
                          }
                        >
                          Approve
                        </Button>
                      </div>
                    </section>
                  )}
                  <SpeakerProfileEditor
                    key={selected.contact.id}
                    eventId={eventId}
                    timezone={timezone}
                    row={selected}
                    refresh={refresh}
                  />
                  <section>
                    <SectionLabel>Workflow status</SectionLabel>
                    <Select
                      value={
                        statusOverrides.get(selected.contact.id) ?? selected.contact.workflowStatus
                      }
                      onValueChange={(value) => {
                        if (
                          value === "invited" ||
                          value === "onboarding" ||
                          value === "confirmed" ||
                          value === "ready" ||
                          value === "declined"
                        )
                          workflow.mutate({
                            contactId: selected.contact.id,
                            workflowStatus: value,
                          });
                      }}
                    >
                      <SelectTrigger size="sm" className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(workflowLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>
                  <section>
                    <SectionLabel>Profile readiness</SectionLabel>
                    <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
                      <ReadinessLine
                        label="Bio"
                        detail={hasRichText(selected.contact.bio) ? "Present" : "Missing"}
                        tone={hasRichText(selected.contact.bio) ? "accepted" : "pending"}
                      />
                      <ReadinessLine
                        label="Headshot"
                        detail={
                          selected.contact.headshotUrl !== null ||
                          selected.files.some((file) => file.kind === "headshot")
                            ? "Present"
                            : "Missing"
                        }
                        tone={
                          selected.contact.headshotUrl !== null ||
                          selected.files.some((file) => file.kind === "headshot")
                            ? "accepted"
                            : "pending"
                        }
                      />
                      <ReadinessLine
                        label="Dietary"
                        detail={
                          dietaryLabels[selected.contact.dietaryRequirements] === "—"
                            ? "Answered"
                            : (dietaryLabels[selected.contact.dietaryRequirements] ?? "Answered")
                        }
                        tone="accepted"
                      />
                      <ReadinessLine
                        label="T-shirt"
                        detail={selected.contact.tshirtSize ?? "Missing"}
                        tone={selected.contact.tshirtSize === null ? "pending" : "accepted"}
                      />
                      <ReadinessLine
                        label="Profile approval"
                        detail={
                          effectiveProfileStatus === "approved"
                            ? "Approved"
                            : effectiveProfileStatus === "rejected"
                              ? "Rejected"
                              : "Pending review"
                        }
                        tone={
                          effectiveProfileStatus === "approved"
                            ? "accepted"
                            : effectiveProfileStatus === "rejected"
                              ? "declined"
                              : "pending"
                        }
                      />
                    </div>
                  </section>
                  <section>
                    <SectionLabel>Contact and logistics</SectionLabel>
                    <p className="mt-1">
                      {selected.contact.email}
                      {selected.contact.phone === null ? "" : ` · ${selected.contact.phone}`}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {dietaryLabels[selected.contact.dietaryRequirements] === "—"
                        ? "No dietary needs"
                        : dietaryLabels[selected.contact.dietaryRequirements]}
                      {selected.contact.tshirtSize === null
                        ? ""
                        : ` · T-shirt ${selected.contact.tshirtSize}`}
                    </p>
                    <div className="mt-2 flex items-start gap-2">
                      {typeof selected.contact.custom.travelLogistics === "string" &&
                      selected.contact.custom.travelLogistics.trim() !== "" ? (
                        <>
                          <p className="min-w-0 flex-1 whitespace-pre-wrap text-muted-foreground">
                            {selected.contact.custom.travelLogistics}
                          </p>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="pressable shrink-0"
                            onClick={() => {
                              setEditing(selected);
                              setFormOpen(true);
                            }}
                          >
                            <PencilIcon /> Edit
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="pressable -ml-2 text-muted-foreground"
                          onClick={() => {
                            setEditing(selected);
                            setFormOpen(true);
                          }}
                        >
                          <PencilIcon /> Add travel notes
                        </Button>
                      )}
                    </div>
                    <RichText
                      markdown={selected.contact.bio}
                      className="mt-2 text-muted-foreground"
                      fallback={<p className="mt-2 italic text-muted-foreground">No bio yet.</p>}
                    />
                  </section>
                  <section>
                    <SectionLabel>Sessions</SectionLabel>
                    <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
                      {selected.sessions.length === 0 ? (
                        <p className="flex h-8 items-center px-3 text-muted-foreground">
                          No sessions attached.
                        </p>
                      ) : (
                        selected.sessions.map((session) => (
                          <Link
                            key={session.id}
                            to="/admin/sessions"
                            search={{ state: "all", spotlight: session.id }}
                            className="flex h-8 min-w-0 items-center gap-2 px-3 transition-colors hover:bg-muted/50"
                          >
                            <span className="shrink-0 font-mono tabular-nums">{session.code}</span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {session.title}
                            </span>
                            <SessionReadinessBadge session={session} />
                          </Link>
                        ))
                      )}
                    </div>
                  </section>
                  {selected.otherSubmissions.length === 0 ? null : (
                    <section>
                      <SectionLabel>Other submissions</SectionLabel>
                      <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
                        {selected.otherSubmissions.map((submission) => (
                          <Link
                            key={submission.id}
                            to="/admin/submissions"
                            search={{ status: "all", spotlight: submission.id }}
                            className="flex h-8 min-w-0 items-center gap-2 px-3 transition-colors hover:bg-muted/50"
                          >
                            <span className="shrink-0 font-mono tabular-nums">
                              {submission.code}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {submission.title}
                            </span>
                            <StatusBadge status={submission.status} />
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                  <section>
                    <SectionLabel>Tasks</SectionLabel>
                    <div className="mt-1.5 max-w-xl divide-y overflow-hidden rounded-lg border">
                      {selected.tasks.length === 0 ? (
                        <p className="flex h-8 items-center px-3 text-muted-foreground">
                          No tasks assigned.
                        </p>
                      ) : (
                        selected.tasks.map((task) => {
                          const status = waivedIds.has(task.id) ? "waived" : task.status;
                          return (
                            <div
                              key={task.id}
                              className="flex min-w-0 items-center gap-1 px-2 transition-colors hover:bg-muted/50"
                            >
                              <button
                                type="button"
                                className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                                onClick={() => setPeekTaskId(task.id)}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="font-medium">{task.title}</span>
                                  <span className="ml-1 text-[11px] text-muted-foreground">
                                    {task.submissionCode === null ? null : (
                                      <span className="font-mono tabular-nums">
                                        {task.submissionCode} ·{" "}
                                      </span>
                                    )}
                                    {task.dueDate === null
                                      ? "No due date"
                                      : shortDate(task.dueDate, timezone)}
                                  </span>
                                </span>
                                <Badge
                                  variant={status === "todo" ? "outline" : "secondary"}
                                  className="h-5 shrink-0 rounded-sm px-1.5 text-[10px] font-normal"
                                >
                                  {taskStatusLabels[status]}
                                </Badge>
                              </button>
                              {status === "todo" ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  className="pressable h-6 px-1.5 text-[11px]"
                                  onClick={() => waive.mutate(task.id)}
                                >
                                  Waive
                                </Button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                  <section>
                    <SectionLabel>Files</SectionLabel>
                    <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
                      {selected.files.length === 0 ? (
                        <p className="flex h-8 items-center px-3 text-muted-foreground">
                          No files yet.
                        </p>
                      ) : (
                        selected.files.map((file) => (
                          <div key={file.id} className="flex h-8 min-w-0 items-center gap-2 px-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{file.filename}</p>
                              <p className="truncate text-[10px] leading-none text-muted-foreground">
                                {file.label}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                              {formatBytes(file.size)} · {file.uploaderName} ·{" "}
                              <Timestamp value={file.uploadedAt} timezone={timezone}>
                                {shortDate(file.uploadedAt, timezone)}
                              </Timestamp>
                            </span>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              className="pressable"
                              aria-label={`Download ${file.filename}`}
                              onClick={() => void downloadFile(file.versionId)}
                            >
                              <DownloadIcon />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                  <section>
                    <SectionLabel>Emails</SectionLabel>
                    <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
                      {selected.emails.length === 0 ? (
                        <p className="flex h-8 items-center px-3 text-muted-foreground">
                          No emails sent.
                        </p>
                      ) : (
                        selected.emails.map((email) => (
                          <Link
                            key={email.id}
                            to="/admin/emails"
                            search={{ email: email.id }}
                            className="pressable flex h-8 min-w-0 items-center gap-2 px-3 transition-colors hover:bg-muted/50 hover:text-foreground"
                          >
                            <span className="min-w-0 flex-1 truncate">{email.subject}</span>
                            <Badge
                              variant="secondary"
                              className="h-5 max-w-24 truncate rounded-sm px-1.5 text-[10px] font-normal"
                            >
                              {emailTypeLabels[email.type]}
                            </Badge>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] capitalize text-muted-foreground">
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  email.status === "sent"
                                    ? readinessToneClass.accepted
                                    : email.status === "failed"
                                      ? readinessToneClass.declined
                                      : readinessToneClass.pending,
                                )}
                              />
                              {email.status}
                            </span>
                            <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                              {email.sentAt === null ? (
                                "—"
                              ) : (
                                <Timestamp value={email.sentAt} timezone={timezone}>
                                  {shortDate(email.sentAt, timezone)}
                                </Timestamp>
                              )}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )
        }
      />
      <Sheet
        open={peekTaskId !== undefined}
        onOpenChange={(open) => {
          if (!open) setPeekTaskId(undefined);
        }}
      >
        <SheetContent className="gap-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2 pr-8">
              <SheetTitle className="truncate text-sm">
                {peekAssignment?.template.title ?? peekTask?.title ?? "Task"}
              </SheetTitle>
              {peekTask === undefined ? null : (
                <Badge
                  variant={
                    (waivedIds.has(peekTask.id) ? "waived" : peekTask.status) === "todo"
                      ? "outline"
                      : "secondary"
                  }
                  className="h-5 shrink-0 rounded-sm px-1.5 text-[10px] font-normal"
                >
                  {taskStatusLabels[waivedIds.has(peekTask.id) ? "waived" : peekTask.status]}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs">
              {peekTask?.dueDate === null || peekTask?.dueDate === undefined
                ? "No due date"
                : `Due ${new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: timezone,
                  }).format(peekTask.dueDate)}`}
            </SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-4 text-sm [&>section]:min-w-0">
            <section>
              <SectionLabel>Instructions</SectionLabel>
              <RichText
                markdown={peekAssignment?.template.instructions}
                className="mt-1 text-xs text-muted-foreground"
                fallback={<p className="mt-1 text-xs text-muted-foreground">No instructions.</p>}
              />
            </section>
            {selected === undefined ? null : (
              <section>
                <SectionLabel>Speaker</SectionLabel>
                <div className="mt-1">
                  <SpeakerBadge
                    person={{
                      id: selected.contact.id,
                      name: `${selected.contact.firstName} ${selected.contact.lastName}`,
                      image: selected.contact.headshotUrl,
                      title: selected.contact.title,
                      company: selected.contact.company,
                      bio: selected.contact.bio,
                      status:
                        statusOverrides.get(selected.contact.id) ?? selected.contact.workflowStatus,
                      sessionsCount: selected.sessions.length,
                    }}
                  />
                </div>
              </section>
            )}
            {peekAssignment?.submission === null ||
            peekAssignment?.submission === undefined ? null : (
              <section>
                <SectionLabel>Session</SectionLabel>
                <Link
                  to="/admin/sessions"
                  search={{ state: "all", spotlight: peekAssignment.submission.id }}
                  className="pressable mt-1 flex min-w-0 items-center gap-2 rounded-sm py-1 text-xs hover:text-foreground"
                >
                  <span className="font-mono tabular-nums">{peekAssignment.submission.code}</span>
                  <span className="truncate text-muted-foreground">
                    {peekAssignment.submission.title}
                  </span>
                </Link>
              </section>
            )}
          </div>
          <SheetFooter className="flex-row justify-end border-t p-3">
            {peekTask !== undefined &&
            (waivedIds.has(peekTask.id) ? "waived" : peekTask.status) === "todo" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={waive.isPending}
                onClick={() => waive.mutate(peekTask.id)}
              >
                Mark waived
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={peekAssignment === undefined}
              onClick={() => {
                if (peekAssignment === undefined) return;
                setEditingTaskTemplateId(peekAssignment.template.id);
                setPeekTaskId(undefined);
              }}
            >
              Edit task
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {portalData === undefined || editingTaskTemplateId === undefined ? null : (
        <TaskTemplateDialog
          key={editingTaskTemplateId}
          eventId={eventId}
          timezone={timezone}
          data={portalData}
          templateId={editingTaskTemplateId}
          initialLink={undefined}
          open
          onOpenChange={(open) => {
            if (!open) setEditingTaskTemplateId(undefined);
          }}
        />
      )}
      <CsvImportDialog
        eventId={eventId}
        speakers={rows}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <SpeakerFormDialog
        key={editing?.contact.id ?? "new"}
        eventId={eventId}
        speaker={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <PortalInviteResultDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        invitations={inviteResults}
      />
    </main>
  );
}

function ProfileReadiness({ row }: { readonly row: SpeakerDirectoryRow }) {
  const ready = [
    hasRichText(row.contact.bio),
    row.contact.headshotUrl !== null || row.files.some((file) => file.kind === "headshot"),
    row.contact.dietaryRequirements !== "none",
    row.contact.tshirtSize !== null,
  ].filter(Boolean).length;
  return <span className="tabular-nums text-muted-foreground">{ready}/4 ready</span>;
}

const formatBytes = (size: number) =>
  size < 1024 ? `${size} B` : `${Math.max(1, Math.round(size / 1024))} KB`;

function SpeakerProfileEditor({
  eventId,
  timezone,
  row,
  refresh,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly row: SpeakerDirectoryRow;
  readonly refresh: () => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(row.contact.bio ?? "");
  const [bioError, setBioError] = useState<string>();
  const [headshotError, setHeadshotError] = useState<string>();
  const saveBio = useMutation({
    mutationFn: () =>
      updateAdminSpeakerProfile({
        data: { eventId, contactId: row.contact.id, bio },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setBioError(result.error.message);
        return;
      }
      setEditing(false);
      setBioError(undefined);
      toast.success(`${row.contact.firstName}'s bio saved and approved`);
      await refresh();
    },
  });
  const replaceHeadshot = useMutation({
    mutationFn: async (file: File) =>
      uploadAdminHeadshot({
        data: {
          eventId,
          contactId: row.contact.id,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          base64: await fileAsBase64(file),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setHeadshotError(result.error.message);
        return;
      }
      setHeadshotError(undefined);
      toast.success(`${row.contact.firstName}'s headshot replaced and approved`);
      await refresh();
    },
  });
  const history = [...row.profileChanges].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Profile</SectionLabel>
        {editing ? null : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="pressable"
            onClick={() => setEditing(true)}
          >
            <PencilIcon /> Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 grid gap-3 rounded-lg border p-3">
          <div className="grid gap-1.5">
            <Label>Bio</Label>
            <RichTextEditor value={bio} onChange={setBio} />
          </div>
          {bioError === undefined ? null : (
            <p className="text-xs text-destructive" role="alert">
              {bioError}
            </p>
          )}
          <div className="grid gap-1">
            <Label>Headshot</Label>
            <p className="text-[11px] text-muted-foreground">
              Accepted: PNG or JPG · Maximum: 5 MB
            </p>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) {
                  setHeadshotError(undefined);
                  replaceHeadshot.mutate(file);
                }
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="pressable mt-1 w-fit"
              disabled={replaceHeadshot.isPending}
              onClick={() => input.current?.click()}
            >
              <UploadIcon />
              {replaceHeadshot.isPending ? "Uploading…" : "Replace headshot"}
            </Button>
            {headshotError === undefined ? null : (
              <p className="text-xs text-destructive" role="alert">
                {headshotError}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setBio(row.contact.bio ?? "");
                setBioError(undefined);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saveBio.isPending}
              onClick={() => saveBio.mutate()}
            >
              {saveBio.isPending ? "Saving…" : "Save bio"}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <SectionLabel>Profile history</SectionLabel>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {history.length} version{history.length === 1 ? "" : "s"}
        </span>
      </div>
      {history.length === 0 ? (
        <p className="mt-1 italic text-muted-foreground">No profile changes yet.</p>
      ) : (
        <div className="mt-1.5 divide-y overflow-hidden rounded-lg border">
          {history.map((entry) => (
            <details key={entry.id}>
              <summary className="pressable flex cursor-pointer list-none items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50">
                <HistoryIcon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entry.authorName}</span>
                  <Timestamp
                    value={entry.createdAt}
                    timezone={timezone}
                    className="block w-fit text-[10px] text-muted-foreground tabular-nums"
                  />
                </span>
                <span className="capitalize text-muted-foreground">
                  {entry.approvalStatus.replace("_", " ")}
                </span>
              </summary>
              <ChangeDiff rows={profileDiffRows(entry)} className="border-t px-3 py-2" />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function Headshot({
  row,
  large = false,
}: {
  readonly row: SpeakerDirectoryRow;
  readonly large?: boolean;
}) {
  const classes = large ? "size-12 text-sm" : "size-8 text-xs";
  const headshot = row.files.find((file) => file.kind === "headshot");
  const stored = useQuery({
    queryKey: qk.immutable.fileVersion(headshot?.versionId ?? "none"),
    queryFn: () => dataUrlForVersion(headshot!.versionId),
    enabled: headshot !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const src = stored.data ?? row.contact.headshotUrl;
  return src === null || src === undefined ? (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold",
        classes,
      )}
    >
      {row.contact.firstName[0]}
      {row.contact.lastName[0]}
    </div>
  ) : (
    <img src={src} alt="" className={cn("shrink-0 rounded-md object-cover", classes)} />
  );
}
