import type { FormFieldDefinition } from "@opensesh/domain";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleMinusIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  FileCheckIcon,
  FileUpIcon,
  FilterIcon,
  PlusIcon,
  ListTodoIcon,
  PencilIcon,
  SendIcon,
} from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { toast } from "sonner";

import { RichText } from "@/components/forms/rich-text";
import { StatusBadge } from "@/components/app/status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SessionContentEditor } from "@/components/admin/session-content-editor";
import { ChangeDiff } from "@/components/app/change-diff";
import { PersonHoverCard } from "@/components/app/person-popover";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpeakerRow } from "@/components/app/speaker-row";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import {
  DatePicker,
  DateTimePicker,
  dateKeyInTimezone,
  formatDateTime,
  zonedDateTimeIso,
} from "@/components/forms/datetime-picker";
import { SpeakerPickerDialog } from "@/components/admin/speaker-picker-dialog";
import { DetailSection } from "@/components/review-desk/submission-detail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { FileThread } from "@/components/portal/file-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { useAdminEvent } from "@/components/app/admin-event-context";
import { qk } from "@/lib/query-keys";
import { contentDiffRows, describeChangedFields } from "@/lib/content-diff";
import { dataUrlForVersion, downloadZip, fetchVersionData } from "@/lib/files";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { adminPortalQuery } from "@/lib/portal-queries";
import { rememberPortalFormList, takePortalFormListReturn } from "@/lib/portal-form-navigation";
import { cn } from "@/lib/utils";
import {
  approveContentChange,
  createAdminFileRequest,
  approveSessionContent,
  deleteAdminSessionFileRequirement,
  getPortalAdmin,
  manualAssignAdminTask,
  rejectContentChange,
  saveAdminSessionFileRequirement,
  saveAdminTaskTemplate,
  waiveAdminAssignment,
} from "@/server-fns/portal";
import { sendDeliverableReminders, sendTaskReminders } from "@/server-fns/mail";

export type AdminData = Extract<
  Awaited<ReturnType<typeof getPortalAdmin>>,
  { readonly ok: true }
>["data"];

const personFor = (data: AdminData, contact: AdminData["participants"][number]["contact"]) => ({
  id: contact.id,
  name: `${contact.firstName} ${contact.lastName}`,
  image: contact.headshotUrl,
  title: contact.title,
  company: contact.company,
  bio: contact.bio,
  status: data.contacts.find((candidate) => candidate.id === contact.id)?.pipeline ?? "added",
  sessionsCount: new Set(
    data.participants
      .filter((row) => row.contact.id === contact.id && row.submission.status === "accepted")
      .map((row) => row.submission.id),
  ).size,
});

const portalFields = (form: AdminData["forms"][number] | undefined) =>
  form?.sections.flatMap((section) => section.fields) ?? [];

const portalAnswer = (value: unknown, field: FormFieldDefinition, timezone: string) => {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(", ");
  if (typeof value !== "string") return "";
  return field.fieldType === "datetime" && value.length > 0
    ? `${formatDateTime(value, timezone)} (${timezone})`
    : value;
};

export function PortalAdminSection({
  section,
  spotlightId,
  fileRequestId,
  onSpotlightChange,
}: {
  readonly section: string;
  readonly spotlightId: string | undefined;
  readonly fileRequestId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const eventContext = useAdminEvent();
  if (eventContext === null) return null;
  return (
    <PortalAdminData
      eventId={eventContext.event.id}
      timezone={eventContext.event.timezone}
      section={section}
      spotlightId={spotlightId}
      fileRequestId={fileRequestId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function PortalAdminData({
  eventId,
  timezone,
  section,
  spotlightId,
  fileRequestId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly section: string;
  readonly spotlightId: string | undefined;
  readonly fileRequestId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  if (section === "tasks")
    return (
      <AdminTasks
        eventId={eventId}
        timezone={timezone}
        data={portal.data.data}
        fileRequestId={fileRequestId}
        spotlightId={spotlightId}
        onSpotlightChange={onSpotlightChange}
      />
    );
  if (section === "portal-forms")
    return <AdminPortalForms eventId={eventId} timezone={timezone} data={portal.data.data} />;
  if (section === "file-requests")
    return <DeliverablesAdmin eventId={eventId} timezone={timezone} data={portal.data.data} />;
  if (section === "content")
    return (
      <AdminSessions
        eventId={eventId}
        timezone={timezone}
        data={portal.data.data}
        spotlightId={spotlightId}
        onSpotlightChange={onSpotlightChange}
      />
    );
  return null;
}

function AdminTasks({
  eventId,
  timezone,
  data,
  fileRequestId,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly fileRequestId: string | undefined;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(fileRequestId !== undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const [taskTemplateId, setTaskTemplateId] = useState("any");
  // A spotlighted speaker lives on the assignments tab; opening one (incl.
  // from a URL) lands there, and leaving the tab closes the spotlight.
  const [tab, setTab] = useState(spotlightId === undefined ? "templates" : "assignments");
  const [reminded, setReminded] = useState<ReadonlySet<string>>(new Set());
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<ReadonlySet<string>>(new Set());
  const refresh = () => invalidateAfterMutation(queryClient, eventId);
  const waive = useMutation({
    mutationFn: (assignmentId: string) => waiveAdminAssignment({ data: { eventId, assignmentId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      await refresh();
    },
  });
  const assign = useMutation({
    mutationFn: ({
      taskTemplateId,
      contactId,
    }: {
      readonly taskTemplateId: string;
      readonly contactId: string;
    }) =>
      manualAssignAdminTask({ data: { eventId, taskTemplateId, contactId, submissionId: null } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Task assigned");
      await refresh();
    },
  });
  const remind = useMutation({
    mutationFn: ({
      contactIds,
    }: {
      readonly contactIds: ReadonlyArray<string>;
      readonly ids: ReadonlyArray<string>;
    }) => sendTaskReminders({ data: { eventId, contactId: null, contactIds } }),
    onMutate: ({ ids }) => {
      const previous = reminded;
      setReminded((current) => new Set([...current, ...ids]));
      return { previous };
    },
    onSuccess: async (result, _variables, context) => {
      if (!result.ok) {
        setReminded(context.previous);
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `Queued ${result.data.queued} ${result.data.queued === 1 ? "reminder" : "reminders"}`,
      );
      setSelectedSpeakerIds((current) => {
        const next = new Set(current);
        for (const id of _variables.ids) next.delete(id);
        return next;
      });
      await invalidateAfterMutation(queryClient, eventId);
    },
    onError: (_error, _variables, context) => setReminded(context?.previous ?? new Set()),
  });
  const templateRows = data.templates.map((row) => ({
    ...row,
    assigned: data.assignments.filter((item) => item.assignment.taskTemplateId === row.template.id),
    done: data.assignments.filter(
      (item) =>
        item.assignment.taskTemplateId === row.template.id && item.assignment.status !== "todo",
    ),
  }));
  const speakers = data.contacts
    .map((contact) => {
      const submissionIds = data.participants
        .filter((row) => row.contact.id === contact.id)
        .map((row) => row.submission.id);
      const assignments = data.assignments.filter(
        (row) =>
          row.assignment.contactId === contact.id ||
          (row.assignment.submissionId !== null &&
            submissionIds.includes(row.assignment.submissionId)),
      );
      const outstanding = assignments.filter((row) => row.assignment.status === "todo").length;
      return { contact, assignments, outstanding, done: assignments.length - outstanding };
    })
    .filter(
      (row) =>
        (!outstandingOnly || row.outstanding > 0) &&
        (taskTemplateId === "any" ||
          row.assignments.some(
            (assignment) =>
              assignment.assignment.taskTemplateId === taskTemplateId &&
              assignment.assignment.status === "todo",
          )),
    )
    .sort(
      (left, right) =>
        right.outstanding - left.outstanding ||
        left.contact.lastName.localeCompare(right.contact.lastName),
    );
  const speakerPages = usePagination(speakers, {
    resetKey: `${String(outstandingOnly)}:${taskTemplateId}`,
    spotlightId,
    getId: (row) => row.contact.id,
  });
  const spotlightRow = speakers.find((row) => row.contact.id === spotlightId);
  const open = (id: string | null) => {
    setEditingId(id);
    setDrawer(true);
  };
  const outstandingIds = speakers
    .filter((speaker) => speaker.outstanding > 0)
    .map((speaker) => speaker.contact.id);
  const allOutstandingSelected =
    outstandingIds.length > 0 && outstandingIds.every((id) => selectedSpeakerIds.has(id));
  const selectedReminderIds = outstandingIds.filter((id) => selectedSpeakerIds.has(id));

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={speakers.map((row) => row.contact.id)}
        onSpotlightChange={onSpotlightChange}
        clearFilters={() => {
          setOutstandingOnly(false);
          setTaskTemplateId("any");
        }}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="flex shrink-0 items-end justify-between">
              <div>
                <h1 className="text-lg font-semibold">Tasks</h1>
                <p className="text-xs text-muted-foreground">
                  Templates and real-time speaker readiness.
                </p>
              </div>
              <Button size="sm" onClick={() => open(null)}>
                <PlusIcon /> Add task
              </Button>
            </div>
            <Tabs
              value={spotlightId === undefined ? tab : "assignments"}
              onValueChange={(value) => {
                setTab(value);
                if (value === "templates" && spotlightId !== undefined)
                  onSpotlightChange(undefined, { replace: true, keyboard: false });
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList variant="line">
                <TabsTrigger value="templates">Templates ({templateRows.length})</TabsTrigger>
                <TabsTrigger value="assignments">Assignments board</TabsTrigger>
              </TabsList>
              <TabsContent value="templates" className="min-h-0 flex-1 overflow-y-auto pt-3">
                {templateRows.length === 0 ? (
                  <AdminEmptyState
                    icon={ListTodoIcon}
                    title="Create your first speaker task"
                    description="Define one reusable onboarding step, then assign it to speakers."
                    action={
                      <Button size="sm" className="pressable" onClick={() => open(null)}>
                        <PlusIcon /> Add task
                      </Button>
                    }
                  />
                ) : (
                  <div className="max-w-4xl divide-y overflow-hidden rounded-lg border">
                    {templateRows.map((row) => (
                      <button
                        key={row.template.id}
                        type="button"
                        className="pressable-row flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                        onClick={() => open(row.template.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{row.template.title}</span>
                            <Badge variant="outline" className="capitalize">
                              {row.template.scope}
                            </Badge>
                            {row.template.autoAssignOnAccept ? (
                              <Badge variant="secondary">Auto-assign</Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {row.form?.name ?? row.fileRequest?.title ?? "Manual completion"}
                          </p>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.done.length}/{row.assigned.length} done
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="assignments" className="flex min-h-0 flex-1 flex-col pt-3">
                <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                      <Checkbox
                        checked={outstandingOnly}
                        onCheckedChange={(checked) => setOutstandingOnly(checked === true)}
                      />
                      <FilterIcon className="size-3.5" /> Has outstanding
                    </label>
                    <Select value={taskTemplateId} onValueChange={setTaskTemplateId}>
                      <SelectTrigger size="sm" className="w-44 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any task</SelectItem>
                        {data.templates.map((row) => (
                          <SelectItem key={row.template.id} value={row.template.id}>
                            {row.template.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                      <Checkbox
                        checked={
                          allOutstandingSelected
                            ? true
                            : outstandingIds.some((id) => selectedSpeakerIds.has(id))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) =>
                          setSelectedSpeakerIds(
                            checked === true ? new Set(outstandingIds) : new Set(),
                          )
                        }
                      />
                      Select outstanding
                    </label>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={remind.isPending || selectedReminderIds.length === 0}
                    onClick={() => {
                      remind.mutate({ contactIds: selectedReminderIds, ids: selectedReminderIds });
                    }}
                  >
                    <SendIcon />
                    {remind.isPending
                      ? "Sending…"
                      : `Send ${selectedReminderIds.length} reminder${selectedReminderIds.length === 1 ? "" : "s"}`}
                  </Button>
                </div>
                <TableShell
                  scrollRef={scrollRef}
                  footer={
                    <PaginationFooter
                      page={speakerPages.page}
                      pageSize={speakerPages.pageSize}
                      total={speakers.length}
                      onPageChange={speakerPages.setPage}
                    />
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-9">
                          <span className="sr-only">Select</span>
                        </TableHead>
                        <TableHead>Speaker</TableHead>
                        {compact ? null : <TableHead>Dietary</TableHead>}
                        {compact ? null : <TableHead>T-shirt</TableHead>}
                        <TableHead className="text-right">Outstanding</TableHead>
                        {compact ? null : <TableHead className="text-right">Done</TableHead>}
                        {compact ? null : (
                          <TableHead className="w-28 text-right">Reminder</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {speakerPages.pageItems.map((row) => (
                        <TableRow
                          key={row.contact.id}
                          ref={rowRef(row.contact.id)}
                          className={cn("h-9 cursor-pointer", rowClassName(row.contact.id))}
                          onClick={() => openSpotlight(row.contact.id)}
                        >
                          <TableCell className="w-9">
                            <Checkbox
                              aria-label={`Select ${row.contact.firstName} ${row.contact.lastName}`}
                              checked={selectedSpeakerIds.has(row.contact.id)}
                              disabled={row.outstanding === 0}
                              onClick={(event) => event.stopPropagation()}
                              onCheckedChange={(checked) =>
                                setSelectedSpeakerIds((current) => {
                                  const next = new Set(current);
                                  if (checked === true) next.add(row.contact.id);
                                  else next.delete(row.contact.id);
                                  return next;
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="h-9 py-1.5">
                            <SpeakerBadge person={personFor(data, row.contact)} />
                          </TableCell>
                          {compact ? null : (
                            <TableCell className="capitalize">
                              {row.contact.dietaryRequirements.replace("_", "-")}
                            </TableCell>
                          )}
                          {compact ? null : <TableCell>{row.contact.tshirtSize ?? "—"}</TableCell>}
                          <TableCell className="text-right font-medium tabular-nums">
                            {row.outstanding}
                          </TableCell>
                          {compact ? null : (
                            <TableCell className="text-right tabular-nums">{row.done}</TableCell>
                          )}
                          {compact ? null : (
                            <TableCell className="text-right">
                              {row.outstanding === 0 ? null : (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={reminded.has(row.contact.id)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    remind.mutate({
                                      contactIds: [row.contact.id],
                                      ids: [row.contact.id],
                                    });
                                  }}
                                >
                                  <SendIcon />
                                  {reminded.has(row.contact.id) ? "Queued" : "Remind"}
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableShell>
              </TabsContent>
            </Tabs>
          </div>
        )}
        panel={
          spotlightRow === undefined ? null : (
            <TaskSpeakerPeek
              data={data}
              timezone={timezone}
              row={spotlightRow}
              reminded={reminded.has(spotlightRow.contact.id)}
              remindPending={remind.isPending}
              onRemind={() =>
                remind.mutate({
                  contactIds: [spotlightRow.contact.id],
                  ids: [spotlightRow.contact.id],
                })
              }
              waivePending={waive.isPending}
              onWaive={(assignmentId) => waive.mutate(assignmentId)}
              assignPending={assign.isPending}
              onAssign={(templateId) =>
                assign.mutate({ taskTemplateId: templateId, contactId: spotlightRow.contact.id })
              }
              onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
            />
          )
        }
      />
      {/* Mounted on demand so the form re-seeds from scratch each open — the
          always-mounted variant kept the previous task's fields alive. */}
      {drawer ? (
        <TaskTemplateDialog
          eventId={eventId}
          timezone={timezone}
          data={data}
          templateId={editingId}
          initialLink={fileRequestId === undefined ? undefined : `file:${fileRequestId}`}
          open
          onOpenChange={setDrawer}
        />
      ) : null}
    </main>
  );
}

const taskStatusMeta = {
  todo: { icon: CircleDotIcon, className: "text-[var(--status-pending)]", label: "Open" },
  done: { icon: CircleCheckIcon, className: "text-[var(--status-accepted)]", label: "Done" },
  waived: { icon: CircleMinusIcon, className: "text-muted-foreground", label: "Waived" },
} as const;

function TaskSpeakerPeek({
  data,
  timezone,
  row,
  reminded,
  remindPending,
  onRemind,
  waivePending,
  onWaive,
  assignPending,
  onAssign,
  onClose,
}: {
  readonly data: AdminData;
  readonly timezone: string;
  readonly row: {
    readonly contact: AdminData["contacts"][number];
    readonly assignments: AdminData["assignments"];
    readonly outstanding: number;
    readonly done: number;
  };
  readonly reminded: boolean;
  readonly remindPending: boolean;
  readonly onRemind: () => void;
  readonly waivePending: boolean;
  readonly onWaive: (assignmentId: string) => void;
  readonly assignPending: boolean;
  readonly onAssign: (taskTemplateId: string) => void;
  readonly onClose: () => void;
}) {
  const unassigned = data.templates.filter(
    (template) =>
      template.template.scope === "contact" &&
      !row.assignments.some((item) => item.template.id === template.template.id),
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={<SpeakerBadge person={personFor(data, row.contact)} />}
        status={
          row.outstanding === 0 ? (
            <span className="rounded-sm border px-1 py-px text-[10px] font-normal text-[var(--status-accepted)]">
              All done
            </span>
          ) : (
            <span className="rounded-sm border px-1 py-px text-[10px] font-normal text-muted-foreground tabular-nums">
              {row.outstanding} open
            </span>
          )
        }
        actions={
          <div className="flex items-center gap-1">
            {row.outstanding === 0 ? null : (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="pressable"
                disabled={reminded || remindPending}
                onClick={onRemind}
              >
                <SendIcon /> {reminded ? "Queued" : "Remind"}
              </Button>
            )}
            <Button type="button" size="icon-sm" variant="ghost" className="pressable" asChild>
              <Link
                to="/admin/speakers"
                search={{ spotlight: row.contact.id }}
                aria-label="Open speaker profile"
              >
                <ExternalLinkIcon />
              </Link>
            </Button>
          </div>
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-16">
        <DetailSection
          title={`Tasks (${row.done}/${row.assignments.length} done)`}
          className="divide-y"
        >
          {row.assignments.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">No tasks assigned yet.</p>
          ) : (
            row.assignments.map((item) => {
              const meta = taskStatusMeta[item.assignment.status];
              const due =
                item.template.dueDate === null
                  ? null
                  : `Due ${formatDateTime(new Date(item.template.dueDate).toISOString(), timezone)}`;
              return (
                <div key={item.assignment.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <meta.icon className={cn("size-3.5 shrink-0", meta.className)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.template.title}</p>
                    {item.submission === null && due === null ? null : (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.submission === null ? null : (
                          <span className="font-mono tabular-nums">{item.submission.code}</span>
                        )}
                        {item.submission !== null && due !== null ? " · " : null}
                        {due}
                      </p>
                    )}
                  </div>
                  {item.assignment.status === "todo" ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="pressable text-muted-foreground"
                      disabled={waivePending}
                      onClick={() => onWaive(item.assignment.id)}
                    >
                      Waive
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                  )}
                </div>
              );
            })
          )}
        </DetailSection>
        <DetailSection title="Assign a task" className="p-3">
          {unassigned.length === 0 ? (
            <p className="text-xs text-muted-foreground">Every task is already assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((template) => (
                <Button
                  key={template.template.id}
                  type="button"
                  size="xs"
                  variant="outline"
                  className="pressable"
                  disabled={assignPending}
                  onClick={() => onAssign(template.template.id)}
                >
                  <PlusIcon /> {template.template.title}
                </Button>
              ))}
            </div>
          )}
        </DetailSection>
        <DetailSection title="Profile" className="divide-y">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-xs text-muted-foreground">Email</span>
            <span className="truncate text-xs">{row.contact.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-xs text-muted-foreground">Dietary</span>
            <span className="text-xs capitalize">
              {row.contact.dietaryRequirements.replace("_", "-")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-xs text-muted-foreground">T-shirt</span>
            <span className="text-xs">{row.contact.tshirtSize ?? "—"}</span>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

export function TaskTemplateDialog({
  eventId,
  timezone,
  data,
  templateId,
  initialLink,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly templateId: string | null;
  readonly initialLink: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const existing = data.templates.find((row) => row.template.id === templateId)?.template;
  const speakers = data.contacts;
  const assignedContactIds = new Set(
    data.assignments.flatMap((row) =>
      row.assignment.taskTemplateId === templateId && row.assignment.contactId !== null
        ? [row.assignment.contactId]
        : [],
    ),
  );
  const initialContactIds: ReadonlySet<string> =
    assignedContactIds.size > 0
      ? assignedContactIds
      : new Set(speakers.map((speaker) => speaker.id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    instructions: existing?.instructions ?? "",
    scope: existing?.scope ?? "contact",
    link:
      existing?.portalFormId === null || existing?.portalFormId === undefined
        ? existing?.fileRequestId === null || existing?.fileRequestId === undefined
          ? (initialLink ?? "manual")
          : `file:${existing.fileRequestId}`
        : `form:${existing.portalFormId}`,
    auto: initialContactIds.size < speakers.length ? false : (existing?.autoAssignOnAccept ?? true),
    dueDate:
      existing?.dueDate === null || existing?.dueDate === undefined
        ? ""
        : dateKeyInTimezone(existing.dueDate, timezone),
    contactIds: initialContactIds,
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      saveAdminTaskTemplate({
        data: {
          eventId,
          id: templateId,
          title: form.title,
          instructions: form.instructions,
          scope: form.scope === "submission" ? "submission" : "contact",
          completion:
            form.link === "file:new"
              ? { kind: "file:new" as const }
              : form.link.startsWith("form:")
                ? { kind: "form" as const, portalFormId: form.link.slice(5) }
                : form.link.startsWith("file:")
                  ? { kind: "file" as const, fileRequestId: form.link.slice(5) }
                  : { kind: "manual" as const },
          autoAssignOnAccept:
            form.scope === "contact" && form.contactIds.size < speakers.length ? false : form.auto,
          dueDate:
            form.dueDate.length === 0 ? null : zonedDateTimeIso(form.dueDate, 12 * 60, timezone),
          contactIds: form.scope === "contact" ? [...form.contactIds] : [],
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const assigned = form.scope === "contact" ? form.contactIds.size : 0;
      toast.success(
        templateId !== null
          ? "Task saved"
          : `${form.link === "file:new" ? "Task and file request created" : "Task created"}${
              assigned === 0 ? "" : ` — assigned to ${assigned} speaker${assigned === 1 ? "" : "s"}`
            }`,
      );
      onOpenChange(false);
      await invalidateAfterMutation(queryClient, eventId);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing === undefined ? "Create task" : "Edit task"}</DialogTitle>
          <DialogDescription>Configure completion and automatic assignment.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Instructions</Label>
            <RichTextEditor
              value={form.instructions}
              onChange={(instructions) => setForm({ ...form, instructions })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(scope) =>
                  setForm({ ...form, scope: scope === "submission" ? "submission" : "contact" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <DatePicker
                value={form.dueDate}
                onChange={(dueDate) => setForm({ ...form, dueDate })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Completion</Label>
            <Select value={form.link} onValueChange={(link) => setForm({ ...form, link })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual check-off</SelectItem>
                {data.forms.map((item) => (
                  <SelectItem key={item.id} value={`form:${item.id}`}>
                    Form · {item.name}
                  </SelectItem>
                ))}
                {data.fileRequests.map((item) => (
                  <SelectItem key={item.id} value={`file:${item.id}`}>
                    File · {item.title}
                  </SelectItem>
                ))}
                <SelectItem value="file:new">File · New request</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.scope !== "contact" ? null : (
            <div className="grid gap-1.5">
              <Label>Assign speakers</Label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="pressable-row flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50"
              >
                {form.contactIds.size === 0 ? (
                  <span className="text-muted-foreground">No speakers selected</span>
                ) : (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex shrink-0 -space-x-1.5">
                      {speakers
                        .filter((speaker) => form.contactIds.has(speaker.id))
                        .slice(0, 5)
                        .map((speaker) => (
                          <Avatar key={speaker.id} className="size-5 ring-2 ring-background">
                            {speaker.headshotUrl === null ? null : (
                              <AvatarImage src={speaker.headshotUrl} alt="" />
                            )}
                            <AvatarFallback className="text-[9px]">
                              {`${speaker.firstName[0] ?? ""}${speaker.lastName[0] ?? ""}`}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                    </span>
                    <span className="truncate">
                      {form.contactIds.size === speakers.length
                        ? `All ${speakers.length} speakers`
                        : `${form.contactIds.size} of ${speakers.length} speakers`}
                    </span>
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">Edit</span>
              </button>
              <SpeakerPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                contacts={speakers}
                value={form.contactIds}
                onChange={(contactIds) => {
                  const next = new Set(contactIds);
                  setForm({
                    ...form,
                    contactIds: next,
                    auto: next.size < speakers.length ? false : form.auto,
                  });
                }}
                title="Assign speakers"
                description="Everyone selected is assigned this task."
              />
            </div>
          )}
          <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span>
              <span className="block">Auto-assign on accept</span>
              {form.scope === "contact" && form.contactIds.size < speakers.length ? (
                <span className="block text-xs text-muted-foreground">
                  Off while assigning specific speakers
                </span>
              ) : null}
            </span>
            <Switch
              checked={
                form.scope === "contact" && form.contactIds.size < speakers.length
                  ? false
                  : form.auto
              }
              disabled={form.scope === "contact" && form.contactIds.size < speakers.length}
              onCheckedChange={(auto) => setForm({ ...form, auto })}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={form.title.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminPortalForms({
  eventId,
  timezone,
  data,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
}) {
  const [highlightedId, setHighlightedId] = useState<string>();
  const responsePages = usePagination(data.responses);
  useLayoutEffect(() => {
    const returned = takePortalFormListReturn(eventId);
    if (returned === null) return;
    setHighlightedId(returned.formId);
    window.scrollTo(0, returned.scrollY);
    const timer = window.setTimeout(() => setHighlightedId(undefined), 1500);
    return () => window.clearTimeout(timer);
  }, [eventId]);
  const exportCsv = () => {
    const fields = Array.from(
      new Map(data.forms.flatMap((form) => portalFields(form).map((field) => [field.id, field]))),
    );
    const rows: ReadonlyArray<Readonly<Record<string, string>>> = data.responses.map((row) => {
      const form = data.forms.find((item) => item.id === row.response.formId);
      const formFields = new Set(portalFields(form).map((field) => field.id));
      return {
        submitter: `${row.contact.firstName} ${row.contact.lastName}`,
        email: row.contact.email,
        form: form?.name ?? "Form",
        submittedAt: new Date(row.response.submittedAt).toISOString(),
        ...Object.fromEntries(
          fields.map(([id, field]) => [
            field.label,
            formFields.has(id) ? portalAnswer(row.response.answers[id], field, timezone) : "",
          ]),
        ),
      };
    });
    downloadCsv("portal-form-responses.csv", rows);
  };
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Portal forms</h1>
          <p className="text-xs text-muted-foreground">
            Collect structured onboarding information.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link
            to="/admin/portal-forms/$formId"
            params={{ formId: "new" }}
            onClick={() => rememberPortalFormList(eventId, "new")}
          >
            <PlusIcon /> New portal form
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="forms" className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="line">
          <TabsTrigger value="forms">Forms ({data.forms.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses ({data.responses.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="forms" className="min-h-0 flex-1 overflow-y-auto pt-3">
          {data.forms.length === 0 ? (
            <AdminEmptyState
              icon={FileCheckIcon}
              title="Create your first portal form"
              description="Collect structured onboarding details from speakers in their portal."
              action={
                <Button size="sm" asChild className="pressable">
                  <Link
                    to="/admin/portal-forms/$formId"
                    params={{ formId: "new" }}
                    onClick={() => rememberPortalFormList(eventId, "new")}
                  >
                    <PlusIcon /> New portal form
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border">
              {data.forms.map((form) => (
                <Link
                  key={form.id}
                  to="/admin/portal-forms/$formId"
                  params={{ formId: form.id }}
                  className={cn(
                    "spotlight-row pressable-row relative flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                    highlightedId === form.id && "spotlight-row-highlight",
                  )}
                  onClick={() => rememberPortalFormList(eventId, form.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.title}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {form.targetType}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="responses" className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="mb-2 flex shrink-0 justify-end">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <DownloadIcon /> Export CSV
            </Button>
          </div>
          <TableShell
            footer={
              <PaginationFooter
                page={responsePages.page}
                pageSize={responsePages.pageSize}
                total={data.responses.length}
                onPageChange={responsePages.setPage}
              />
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Answers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responsePages.pageItems.map((row) => {
                  const form = data.forms.find((item) => item.id === row.response.formId);
                  const responseFields = portalFields(form);
                  return (
                    <TableRow key={row.response.id}>
                      <TableCell>
                        <SpeakerBadge person={personFor(data, row.contact)} />
                      </TableCell>
                      <TableCell>{form?.name ?? "Form"}</TableCell>
                      <TableCell className="text-xs">
                        <Timestamp value={row.response.submittedAt} timezone={timezone} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{form?.title ?? "Form response"}</DialogTitle>
                              <DialogDescription>{row.contact.email}</DialogDescription>
                            </DialogHeader>
                            <dl className="max-h-96 overflow-auto rounded-md border divide-y">
                              {responseFields.map((field) => (
                                <div key={field.id} className="grid gap-1 px-3 py-2.5">
                                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                                  <dd className="text-sm">
                                    {portalAnswer(
                                      row.response.answers[field.id],
                                      field,
                                      timezone,
                                    ) || "Not provided"}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
        </TabsContent>
      </Tabs>
    </main>
  );
}

type RequestForm = {
  readonly id: string | null;
  readonly title: string;
  readonly scope: "contact" | "submission";
  readonly instructions: string;
  readonly dueAt: string;
};

const emptyRequestForm: RequestForm = {
  id: null,
  title: "",
  scope: "contact",
  instructions: "",
  dueAt: "",
};

function DeliverablesAdmin({
  eventId,
  timezone,
  data,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [newRequestTaskOpen, setNewRequestTaskOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [requirementForm, setRequirementForm] = useState(emptyRequirementForm);
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequestForm);
  const queryClient = useQueryClient();
  const requirements = usePagination(data.requirements);
  const requests = usePagination(data.fileRequests);
  const refresh = () => invalidateAfterMutation(queryClient, eventId);
  const saveRequest = useMutation({
    mutationFn: () =>
      createAdminFileRequest({
        data: {
          eventId,
          id: requestForm.id,
          title: requestForm.title,
          targetType: requestForm.scope,
          instructions: requestForm.instructions,
          dueAt: requestForm.dueAt.length === 0 ? null : requestForm.dueAt,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setRequestOpen(false);
      setRequestForm(emptyRequestForm);
      toast.success(requestForm.id === null ? "File request created" : "File request saved");
      await refresh();
    },
  });
  const saveRequirement = useMutation({
    mutationFn: () =>
      saveAdminSessionFileRequirement({
        data: {
          eventId,
          id: requirementForm.id,
          title: requirementForm.title,
          description: requirementForm.description,
          dueAt: requirementForm.dueAt.length === 0 ? null : requirementForm.dueAt,
          acceptTypes:
            requirementForm.acceptTypes.trim().length === 0 ? null : requirementForm.acceptTypes,
          maxSizeMb:
            requirementForm.maxSizeMb.length === 0 ? null : Number(requirementForm.maxSizeMb),
          scope: requirementForm.scope,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setRequirementOpen(false);
      setRequirementForm(emptyRequirementForm);
      toast.success(requirementForm.id === null ? "Requirement added" : "Requirement saved");
      await refresh();
    },
  });
  const deleteRequirement = useMutation({
    mutationFn: (requirementId: string) =>
      deleteAdminSessionFileRequirement({ data: { eventId, requirementId } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setRequirementOpen(false);
      setRequirementForm(emptyRequirementForm);
      toast.success("Requirement deleted");
      await refresh();
    },
  });
  const remindRequirement = useMutation({
    mutationFn: (input: {
      readonly requirementId: string;
      readonly contactIds: ReadonlyArray<string>;
    }) =>
      sendDeliverableReminders({
        data: {
          eventId,
          requirementId: input.requirementId,
          contactIds: [...input.contactIds],
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Queued ${result.data.queued} reminders`);
      await invalidateAfterMutation(queryClient, eventId);
    },
  });
  const openRequirement = (requirement?: AdminData["requirements"][number]) => {
    setRequirementForm(
      requirement === undefined ? emptyRequirementForm : requirementFormFor(requirement),
    );
    setRequirementOpen(true);
  };
  const openRequest = (request?: AdminData["fileRequests"][number]) => {
    setRequestForm(
      request === undefined
        ? emptyRequestForm
        : {
            id: request.id,
            title: request.title,
            scope: request.targetType,
            instructions: request.instructions,
            dueAt: request.dueAt === null ? "" : new Date(request.dueAt).toISOString(),
          },
    );
    setRequestOpen(true);
  };
  const dueLabel = (dueAt: Date | null) =>
    dueAt === null ? "No due date" : `Due ${formatDateTime(dueAt.toISOString(), timezone)}`;

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-5 overflow-hidden p-4 lg:p-6">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold">Deliverables</h1>
        <p className="text-xs text-muted-foreground">
          Track files required for sessions and requested through speaker tasks.
        </p>
      </div>

      {data.requirements.length === 0 && data.fileRequests.length === 0 ? (
        <AdminEmptyState
          icon={FileUpIcon}
          title="Create your first deliverable"
          description="Request one file from every accepted session or from selected speakers."
          action={
            <div className="flex gap-2">
              <Button size="sm" className="pressable" onClick={() => openRequirement()}>
                <PlusIcon /> Add requirement
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="pressable"
                onClick={() => setNewRequestTaskOpen(true)}
              >
                <PlusIcon /> Add request
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <section>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Session requirements
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Applies to every accepted session.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="pressable"
                onClick={() => openRequirement()}
              >
                <PlusIcon /> Add requirement
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="divide-y">
                {requirements.pageItems.map((requirement) => {
                  const assignments = data.requirementAssignments.filter(
                    (row) => row.requirement.id === requirement.id,
                  );
                  const uploaded = assignments.filter(
                    (row) => row.assignment.status === "uploaded",
                  ).length;
                  const reminderContactIds = assignments.flatMap((row) => {
                    if (row.assignment.status !== "outstanding") return [];
                    if (row.contact !== null) return [row.contact.id];
                    return data.participants
                      .filter((participant) => participant.submission.id === row.submission.id)
                      .map((participant) => participant.contact.id);
                  });
                  const noun = requirement.scope === "contact" ? "speakers" : "sessions";
                  return (
                    <div key={requirement.id} className="flex items-center gap-2">
                      <Link
                        to="/admin/files"
                        search={{
                          deliverable: `requirement:${requirement.id}`,
                          spotlight: undefined,
                        }}
                        className="pressable min-w-0 flex-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {requirement.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {dueLabel(requirement.dueAt)} ·{" "}
                              {requirement.acceptTypes ?? "Any type"} ·{" "}
                              {requirement.maxSizeMb === null
                                ? "Any size"
                                : `${requirement.maxSizeMb} MB max`}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {uploaded} of {assignments.length} {noun} uploaded
                          </span>
                        </span>
                      </Link>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="pressable shrink-0"
                        disabled={reminderContactIds.length === 0 || remindRequirement.isPending}
                        onClick={() =>
                          remindRequirement.mutate({
                            requirementId: requirement.id,
                            contactIds: Array.from(new Set(reminderContactIds)),
                          })
                        }
                      >
                        <SendIcon /> Remind outstanding ({reminderContactIds.length})
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="pressable mr-2"
                        aria-label={`Edit ${requirement.title}`}
                        onClick={() => openRequirement(requirement)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <PaginationFooter
                page={requirements.page}
                pageSize={requirements.pageSize}
                total={data.requirements.length}
                onPageChange={requirements.setPage}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Requested files
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ask specific people for a file, delivered as a task.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="pressable"
                onClick={() => setNewRequestTaskOpen(true)}
              >
                <PlusIcon /> Add request
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="divide-y">
                {requests.pageItems.map((request) => {
                  const uploads = data.files.filter(
                    (file) => file.upload.fileRequestId === request.id,
                  );
                  const linkedTemplates = data.templates.filter(
                    (template) => template.template.fileRequestId === request.id,
                  );
                  return (
                    <div key={request.id} className="flex items-center gap-2">
                      <Link
                        to="/admin/files"
                        search={{ deliverable: `request:${request.id}`, spotlight: undefined }}
                        className="pressable min-w-0 flex-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {request.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {request.targetType === "submission" ? "Per session" : "Per speaker"}{" "}
                              · {dueLabel(request.dueAt)} · {uploads.length} upload
                              {uploads.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          {linkedTemplates.length === 0 ? null : (
                            <span className="max-w-48 truncate text-xs text-muted-foreground">
                              {linkedTemplates
                                .map((template) => template.template.title)
                                .join(", ")}
                            </span>
                          )}
                        </span>
                      </Link>
                      {linkedTemplates.length === 0 ? (
                        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <span>Not assigned to any task yet</span>
                          <Button size="xs" variant="ghost" className="pressable" asChild>
                            <Link
                              to="/admin/$section"
                              params={{ section: "tasks" }}
                              search={{ fileRequest: request.id, spotlight: undefined }}
                            >
                              Create task
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="pressable mr-2"
                        aria-label={`Edit ${request.title}`}
                        onClick={() => openRequest(request)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <PaginationFooter
                page={requests.page}
                pageSize={requests.pageSize}
                total={data.fileRequests.length}
                onPageChange={requests.setPage}
              />
            </div>
          </section>
        </div>
      )}

      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requirementForm.id === null ? "Add session requirement" : "Edit requirement"}
            </DialogTitle>
            <DialogDescription>Applies to every accepted session.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="requirement-title">Title</Label>
              <Input
                id="requirement-title"
                value={requirementForm.title}
                onChange={(event) =>
                  setRequirementForm({ ...requirementForm, title: event.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="requirement-description">Description</Label>
              <Input
                id="requirement-description"
                value={requirementForm.description}
                onChange={(event) =>
                  setRequirementForm({ ...requirementForm, description: event.target.value })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Upload scope</Label>
                <Select
                  value={requirementForm.scope}
                  onValueChange={(scope) =>
                    setRequirementForm({
                      ...requirementForm,
                      scope: scope === "submission" ? "submission" : "contact",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Each speaker uploads their own</SelectItem>
                    <SelectItem value="submission">One upload per session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="requirement-due">Due</Label>
                <DateTimePicker
                  id="requirement-due"
                  value={requirementForm.dueAt}
                  timezone={timezone}
                  onChange={(dueAt) => setRequirementForm({ ...requirementForm, dueAt })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="requirement-size">Size cap (MB)</Label>
                <Input
                  id="requirement-size"
                  type="number"
                  min="1"
                  step="1"
                  value={requirementForm.maxSizeMb}
                  onChange={(event) =>
                    setRequirementForm({ ...requirementForm, maxSizeMb: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="requirement-types">Accepted file types</Label>
              <Input
                id="requirement-types"
                placeholder=".pdf,.key,.pptx"
                value={requirementForm.acceptTypes}
                onChange={(event) =>
                  setRequirementForm({ ...requirementForm, acceptTypes: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            {requirementForm.id === null ? null : (
              <Button
                variant="destructive"
                className="mr-auto"
                disabled={deleteRequirement.isPending}
                onClick={() => {
                  const requirementId = requirementForm.id;
                  if (requirementId !== null) deleteRequirement.mutate(requirementId);
                }}
              >
                {deleteRequirement.isPending ? "Deleting…" : "Delete requirement"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setRequirementOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={requirementForm.title.trim().length === 0 || saveRequirement.isPending}
              onClick={() => saveRequirement.mutate()}
            >
              {saveRequirement.isPending ? "Saving…" : "Save requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {requestForm.id === null ? "Add file request" : "Edit file request"}
            </DialogTitle>
            <DialogDescription>
              Ask specific people for a file through a linked task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="request-title">Title</Label>
              <Input
                id="request-title"
                value={requestForm.title}
                onChange={(event) => setRequestForm({ ...requestForm, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="request-instructions">Instructions</Label>
              <RichTextEditor
                value={requestForm.instructions}
                onChange={(instructions) => setRequestForm({ ...requestForm, instructions })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Audience</Label>
                <Select
                  value={requestForm.scope}
                  onValueChange={(scope) =>
                    setRequestForm({
                      ...requestForm,
                      scope: scope === "submission" ? "submission" : "contact",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Per speaker</SelectItem>
                    <SelectItem value="submission">Per session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="request-due">Due</Label>
                <DateTimePicker
                  id="request-due"
                  value={requestForm.dueAt}
                  timezone={timezone}
                  onChange={(dueAt) => setRequestForm({ ...requestForm, dueAt })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={requestForm.title.trim().length === 0 || saveRequest.isPending}
              onClick={() => saveRequest.mutate()}
            >
              {saveRequest.isPending ? "Saving…" : "Save request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {newRequestTaskOpen ? (
        <TaskTemplateDialog
          eventId={eventId}
          timezone={timezone}
          data={data}
          templateId={null}
          initialLink="file:new"
          open
          onOpenChange={(open) => {
            if (!open) setNewRequestTaskOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

type RequirementForm = {
  readonly id: string | null;
  readonly title: string;
  readonly description: string;
  readonly dueAt: string;
  readonly acceptTypes: string;
  readonly maxSizeMb: string;
  readonly scope: "contact" | "submission";
};

const emptyRequirementForm: RequirementForm = {
  id: null,
  title: "",
  description: "",
  dueAt: "",
  acceptTypes: "",
  maxSizeMb: "",
  scope: "contact",
};

const requirementFormFor = (requirement: AdminData["requirements"][number]): RequirementForm => ({
  id: requirement.id,
  title: requirement.title,
  description: requirement.description,
  dueAt: requirement.dueAt === null ? "" : new Date(requirement.dueAt).toISOString(),
  acceptTypes: requirement.acceptTypes ?? "",
  maxSizeMb: requirement.maxSizeMb?.toString() ?? "",
  scope: requirement.scope,
});

const contentStateMeta = {
  approved: {
    label: "Approved",
    icon: CircleCheckIcon,
    className: "text-[var(--status-accepted)]",
  },
  awaiting: {
    label: "Awaiting approval",
    icon: CircleDashedIcon,
    className: "text-[var(--status-pending)]",
  },
  changes: {
    label: "Changes pending",
    icon: CircleDotIcon,
    className: "text-[var(--status-pending)]",
  },
} as const;

// Acceptance and publication are separate judgments: accepted sessions reach
// public surfaces only once their content is approved.
const contentStateFor = (submission: AdminData["submissions"][number]) =>
  submission.status !== "accepted"
    ? null
    : submission.contentReviewStatus === "approved"
      ? ("approved" as const)
      : Object.keys(submission.approvedSnapshot).length === 0
        ? ("awaiting" as const)
        : ("changes" as const);

function ContentStateBadge({
  submission,
}: {
  readonly submission: AdminData["submissions"][number];
}) {
  const state = contentStateFor(submission);
  if (state === null) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = contentStateMeta[state];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.className)}>
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

function AdminSessions({
  eventId,
  timezone,
  data,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => invalidateAfterMutation(queryClient, eventId);
  const review = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      readonly id: string;
      readonly decision: "approve" | "reject";
    }) =>
      decision === "approve"
        ? approveContentChange({ data: { eventId, historyId: id } })
        : rejectContentChange({ data: { eventId, historyId: id } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Content review updated");
      await refresh();
    },
  });
  const approvePublication = useMutation({
    mutationFn: (submissionIds: ReadonlyArray<string>) =>
      approveSessionContent({ data: { eventId, submissionIds: [...submissionIds] } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else
        toast.success(
          `${result.data.approved} ${result.data.approved === 1 ? "session" : "sessions"} approved for publication`,
        );
      await refresh();
    },
  });
  const pendingHistory = data.history
    .map((item) => item.history)
    .filter((item) => item.approvalStatus === "pending_review");
  const pendingProfiles = data.profileHistory.filter(
    (item) => item.history.approvalStatus === "pending_review",
  );
  // Content is a session surface: accepted submissions with an active session.
  // Cancelled sessions leave the publication pipeline until reinstated.
  const contentSubmissions = data.submissions.filter(
    (item) => item.status === "accepted" && item.cancelledAt === null,
  );
  const unapproved = contentSubmissions.filter((item) => item.contentReviewStatus !== "approved");
  const submissionPages = usePagination(contentSubmissions, {
    spotlightId,
    getId: (submission) => submission.id,
  });
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={contentSubmissions.map((submission) => submission.id)}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">Content</h1>
                <p className="text-xs text-muted-foreground">
                  Accepted session content, speakers, and approval history.
                </p>
              </div>
            </div>
            {contentSubmissions.length === 0 ? (
              <AdminEmptyState
                icon={FileCheckIcon}
                title="No session content yet"
                description="Accept a submission before speaker content and approvals can appear here."
                action={
                  <Button asChild size="sm" className="pressable">
                    <Link to="/admin/submissions" search={{ status: "all", spotlight: undefined }}>
                      Review submissions
                    </Link>
                  </Button>
                }
              />
            ) : (
              <>
                {unapproved.length === 0 ? null : (
                  <div className="flex h-9 shrink-0 items-center gap-2 rounded-md border bg-muted/30 px-3 text-xs">
                    <CircleDashedIcon className="size-3.5 shrink-0 text-[var(--status-pending)]" />
                    <span className="min-w-0 flex-1 truncate">
                      {unapproved.length === 1
                        ? "1 accepted session is"
                        : `${unapproved.length} accepted sessions are`}{" "}
                      not public yet — approve their content to publish.
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      className="pressable"
                      disabled={approvePublication.isPending}
                      onClick={() => approvePublication.mutate(unapproved.map((item) => item.id))}
                    >
                      <CircleCheckIcon /> Approve all
                    </Button>
                  </div>
                )}
                {pendingHistory.length + pendingProfiles.length === 0 ? null : (
                  <div className="overflow-hidden rounded-md border">
                    <div className="flex h-9 items-center gap-2 border-b bg-muted/30 px-3">
                      <span className="text-xs font-medium">Awaiting approval</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {pendingHistory.length + pendingProfiles.length}
                      </span>
                    </div>
                    <div className="divide-y">
                      {pendingHistory.map((entry) => {
                        const submission = data.submissions.find(
                          (item) => item.id === entry.submissionId,
                        );
                        return (
                          <div
                            key={entry.id}
                            className="flex h-10 items-center gap-2.5 px-3 text-xs"
                          >
                            <span className="w-14 shrink-0 rounded-sm border px-1.5 py-px text-center text-[10px] text-muted-foreground">
                              Session
                            </span>
                            <span className="min-w-0 truncate">
                              <span className="font-mono tabular-nums">{submission?.code}</span>{" "}
                              <span className="font-medium">{submission?.title}</span>
                            </span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {entry.authorName} changed{" "}
                              {describeChangedFields(entry.changedFields)}
                            </span>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Review content changes</DialogTitle>
                                  <DialogDescription>
                                    {submission?.code} · {entry.authorName}
                                  </DialogDescription>
                                </DialogHeader>
                                <ChangeDiff rows={contentDiffRows(entry)} />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      review.mutate({ id: entry.id, decision: "reject" })
                                    }
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    onClick={() =>
                                      review.mutate({ id: entry.id, decision: "approve" })
                                    }
                                  >
                                    Approve
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        );
                      })}
                      {pendingProfiles.map(({ history: entry, contact }) => (
                        <div key={entry.id} className="flex h-10 items-center gap-2.5 px-3 text-xs">
                          <span className="w-14 shrink-0 rounded-sm border px-1.5 py-px text-center text-[10px] text-muted-foreground">
                            Profile
                          </span>
                          <PersonHoverCard person={personFor(data, contact)}>
                            <span className="min-w-0 truncate font-medium">
                              {contact.firstName} {contact.lastName}
                            </span>
                          </PersonHoverCard>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            changed {describeChangedFields(entry.changedFields)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="pressable h-7 px-2 text-xs"
                            asChild
                          >
                            <Link to="/admin/speakers" search={{ spotlight: contact.id }}>
                              Review
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <TableShell
                  scrollRef={scrollRef}
                  footer={
                    <PaginationFooter
                      page={submissionPages.page}
                      pageSize={submissionPages.pageSize}
                      total={contentSubmissions.length}
                      onPageChange={submissionPages.setPage}
                    />
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Content</TableHead>
                        {compact ? null : <TableHead>Speakers</TableHead>}
                        {compact ? null : <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contentSubmissions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={compact ? 2 : 4}
                            className="h-12 text-center text-xs text-muted-foreground"
                          >
                            No sessions yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {submissionPages.pageItems.map((submission) => {
                        const speakers = data.participants.filter(
                          (row) => row.submission.id === submission.id,
                        );
                        return (
                          <TableRow
                            key={submission.id}
                            ref={rowRef(submission.id)}
                            className={cn("h-9 cursor-pointer", rowClassName(submission.id))}
                            onClick={() => openSpotlight(submission.id)}
                          >
                            <TableCell className="h-9 py-1.5">
                              <span className="flex min-w-0 items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="h-5 shrink-0 rounded-sm px-1.5 font-mono text-[10px] font-normal tabular-nums"
                                >
                                  {submission.code}
                                </Badge>
                                <span className={cn("truncate font-medium", compact && "max-w-52")}>
                                  {submission.title}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className="h-9 py-1.5">
                              <ContentStateBadge submission={submission} />
                            </TableCell>
                            {compact ? null : (
                              <TableCell className="h-9 py-1.5">
                                {speakers.length === 0 ? (
                                  "—"
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {speakers.map((row) => (
                                      <SpeakerBadge
                                        key={row.contact.id}
                                        person={personFor(data, row.contact)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            )}
                            {compact ? null : (
                              <TableCell className="h-9 py-1.5 text-right">
                                {contentStateFor(submission) === "awaiting" ? (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="pressable"
                                    disabled={approvePublication.isPending}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      approvePublication.mutate([submission.id]);
                                    }}
                                  >
                                    <CircleCheckIcon /> Approve
                                  </Button>
                                ) : (
                                  <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableShell>
              </>
            )}
          </div>
        )}
        panel={
          <SessionPeek
            data={data}
            eventId={eventId}
            timezone={timezone}
            submissionId={spotlightId}
            onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
          />
        }
      />
    </main>
  );
}

function SessionPeek({
  data,
  eventId,
  timezone,
  submissionId,
  onClose,
}: {
  readonly data: AdminData;
  readonly eventId: string;
  readonly timezone: string;
  readonly submissionId: string | undefined;
  readonly onClose: () => void;
}) {
  const submission = data.submissions.find((item) => item.id === submissionId);
  const speakers = data.participants.filter((row) => row.submission.id === submissionId);
  const history = data.history
    .map((item) => item.history)
    .filter((item) => item.submissionId === submissionId);
  const assets = data.requirementAssignments
    .filter((row) => row.submission.id === submissionId)
    .map((row) => ({
      assignment: row.assignment,
      requirement: row.requirement,
      contact: row.contact,
      file: data.files.find((item) => item.upload.assignmentId === row.assignment.id),
    }));
  const uploadedAssets = assets.filter((asset) => asset.file !== undefined);
  const downloadAll = async () => {
    if (submission === undefined) return;
    const current = uploadedAssets.flatMap(({ file }) =>
      data.versions
        .map((item) => item.version)
        .filter((version) => version.fileUploadId === file?.upload.id)
        .sort(
          (left, right) =>
            new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
        )
        .slice(0, 1),
    );
    const files = (
      await Promise.all(current.map((version) => fetchVersionData(version.id)))
    ).filter((file) => file !== null);
    if (files.length === 0) {
      toast.error("No stored files are available to download");
      return;
    }
    downloadZip(`${submission.code.toLowerCase()}-files.zip`, files);
  };
  if (submission === undefined) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {submission.code}
          </span>
        }
        status={<StatusBadge status={submission.status} />}
        actions={
          <Button size="icon-sm" variant="ghost" className="pressable" asChild>
            <Link
              to="/admin/submissions/$id"
              params={{ id: submission.id }}
              search={{ status: "all" }}
              aria-label="Open full session page"
            >
              <ExternalLinkIcon />
            </Link>
          </Button>
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-16">
        <h2 className="mb-4 text-base font-semibold">{submission.title}</h2>
        <div className="grid gap-5">
          <SessionContentEditor
            eventId={eventId}
            timezone={timezone}
            submission={submission}
            history={history}
          />
          <section className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Speakers</h3>
            {speakers.length === 0 ? (
              <p className="text-xs italic text-muted-foreground/70">No speakers attached.</p>
            ) : (
              speakers.map((row) => (
                <SpeakerCard
                  key={row.contact.id}
                  data={data}
                  contact={row.contact}
                  eventId={eventId}
                  timezone={timezone}
                />
              ))
            )}
          </section>
          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">Files</h3>
              {uploadedAssets.length === 0 ? null : (
                <Button size="sm" variant="outline" onClick={() => void downloadAll()}>
                  <FileArchiveIcon /> Download all
                </Button>
              )}
            </div>
            <div className="divide-y overflow-hidden rounded-lg border">
              {assets.map(({ assignment, requirement, contact, file }) => {
                const versions = data.versions
                  .map((item) => item.version)
                  .filter((version) => version.fileUploadId === file?.upload.id);
                const comments = data.comments
                  .map((item) => item.comment)
                  .filter((comment) => comment.fileUploadId === file?.upload.id);
                return (
                  <div key={assignment.id}>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{requirement.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact === null
                            ? "Shared by session"
                            : `${contact.firstName} ${contact.lastName}`}{" "}
                          · {requirement.acceptTypes ?? "Any file type"}
                          {requirement.maxSizeMb === null
                            ? ""
                            : ` · ${requirement.maxSizeMb} MB max`}
                        </p>
                      </div>
                      {file === undefined ? (
                        <span className="text-xs text-muted-foreground">Not uploaded</span>
                      ) : null}
                    </div>
                    {file === undefined ? null : (
                      <div className="border-t px-3 py-3">
                        <FileThread
                          embedded
                          eventId={eventId}
                          timezone={timezone}
                          authorName={data.currentUserName}
                          upload={file.upload}
                          versions={versions}
                          comments={comments}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const dietaryLabels: Readonly<Record<string, string>> = {
  none: "No dietary needs",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  other: "Dietary: other",
};

function SpeakerCard({
  data,
  contact,
  eventId,
  timezone,
}: {
  readonly data: AdminData;
  readonly contact: AdminData["participants"][number]["contact"];
  readonly eventId: string;
  readonly timezone: string;
}) {
  const headshot = data.files.find(
    (row) => row.contact.id === contact.id && row.upload.kind === "headshot",
  );
  const versions = data.versions
    .map((item) => item.version)
    .filter((version) => version.fileUploadId === headshot?.upload.id);
  const current = [...versions].sort(
    (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  )[0];
  const image = useQuery({
    queryKey: qk.immutable.fileVersion(current?.id ?? "none"),
    queryFn: () => dataUrlForVersion(current!.id),
    enabled: current !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const meta = [
    dietaryLabels[contact.dietaryRequirements] ?? contact.dietaryRequirements,
    contact.tshirtSize === null ? null : `T-shirt ${contact.tshirtSize}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-md border bg-background">
      <div className="p-3">
        <SpeakerRow
          person={personFor(data, contact)}
          email={contact.email}
          image={image.data ?? contact.headshotUrl}
          meta={meta.length === 0 ? undefined : meta}
        />
        <RichText
          markdown={contact.bio}
          className="mt-2 text-xs leading-relaxed text-muted-foreground"
          fallback={<p className="mt-2 text-xs italic text-muted-foreground/70">No bio yet.</p>}
        />
      </div>
      {headshot === undefined ? null : (
        <div className="border-t p-3">
          <FileThread
            eventId={eventId}
            timezone={timezone}
            authorName={data.currentUserName}
            upload={headshot.upload}
            versions={versions}
            comments={data.comments
              .map((item) => item.comment)
              .filter((comment) => comment.fileUploadId === headshot.upload.id)}
          />
        </div>
      )}
    </div>
  );
}

function downloadCsv(filename: string, rows: ReadonlyArray<Readonly<Record<string, string>>>) {
  const headers = Object.keys(rows[0] ?? {});
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [
    headers.map(quote).join(","),
    ...rows.map((row) => headers.map((header) => quote(row[header] ?? "")).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
