import type { FormFieldDefinition } from "@opensesh/domain";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  ChevronRightIcon,
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
  UserRoundCheckIcon,
} from "lucide-react";
import { Fragment, useLayoutEffect, useState } from "react";
import { toast } from "sonner";

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
import { contentDiffRows, describeChangedFields } from "@/lib/content-diff";
import { dataUrlForVersion, downloadZip, fetchVersionData } from "@/lib/files";
import { adminPortalQuery } from "@/lib/portal-queries";
import { rememberPortalFormList, takePortalFormListReturn } from "@/lib/portal-form-navigation";
import { cn } from "@/lib/utils";
import {
  acceptPortalSubmission,
  approveContentChange,
  createAdminFileRequest,
  getPortalAdmin,
  manualAssignAdminTask,
  rejectContentChange,
  saveAdminSessionFileRequirement,
  saveAdminTaskTemplate,
  waiveAdminAssignment,
} from "@/server-fns/portal";
import { sendTaskReminders } from "@/server-fns/mail";

export type AdminData = Extract<
  Awaited<ReturnType<typeof getPortalAdmin>>,
  { readonly ok: true }
>["data"];

const personFor = (data: AdminData, contact: AdminData["contacts"][number]) => ({
  id: contact.id,
  name: `${contact.firstName} ${contact.lastName}`,
  image: contact.headshotUrl,
  title: contact.title,
  company: contact.company,
  bio: contact.bio,
  status: contact.workflowStatus,
  sessionsCount: new Set(
    data.participants
      .filter((row) => row.contact.id === contact.id)
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
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly fileRequestId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(fileRequestId !== undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reminded, setReminded] = useState<ReadonlySet<string>>(new Set());
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<ReadonlySet<string>>(new Set());
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
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
      if (result.data.failed > 0) {
        toast.error(
          `${result.data.failed} of ${result.data.attempted} reminders failed. Retry them in Email delivery.`,
        );
      } else {
        const label = result.data.demo > 0 ? "recorded in demo mode" : "sent";
        toast.success(
          `${result.data.attempted} ${result.data.attempted === 1 ? "reminder" : "reminders"} ${label}`,
        );
      }
      setSelectedSpeakerIds((current) => {
        const next = new Set(current);
        for (const id of _variables.ids) next.delete(id);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-emails", eventId] });
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
    .filter((row) => !outstandingOnly || row.outstanding > 0)
    .sort(
      (left, right) =>
        right.outstanding - left.outstanding ||
        left.contact.lastName.localeCompare(right.contact.lastName),
    );
  const speakerPages = usePagination(speakers, { resetKey: String(outstandingOnly) });
  const open = (id: string | null) => {
    setEditingId(id);
    setDrawer(true);
  };
  const outstandingIds = speakers
    .filter((speaker) => speaker.outstanding > 0)
    .map((speaker) => speaker.contact.id);
  const allOutstandingSelected =
    outstandingIds.length > 0 && outstandingIds.every((id) => selectedSpeakerIds.has(id));

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
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
      <Tabs defaultValue="templates" className="flex min-h-0 flex-1 flex-col">
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
                  className="pressable flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
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
                    setSelectedSpeakerIds(checked === true ? new Set(outstandingIds) : new Set())
                  }
                />
                Select outstanding
              </label>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={remind.isPending || selectedSpeakerIds.size === 0}
              onClick={() => {
                const ids = outstandingIds.filter((id) => selectedSpeakerIds.has(id));
                remind.mutate({ contactIds: ids, ids });
              }}
            >
              <SendIcon />
              {remind.isPending
                ? "Sending…"
                : `Send ${selectedSpeakerIds.size} reminder${selectedSpeakerIds.size === 1 ? "" : "s"}`}
            </Button>
          </div>
          <TableShell
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
                  <TableHead>Dietary</TableHead>
                  <TableHead>T-shirt</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="w-28 text-right">Reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {speakerPages.pageItems.map((row) => (
                  <Fragment key={row.contact.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === row.contact.id ? null : row.contact.id)
                      }
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronDownIcon
                            className={`size-3.5 ${expanded === row.contact.id ? "rotate-180" : ""}`}
                          />
                          <SpeakerBadge person={personFor(data, row.contact)} />
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {row.contact.dietaryRequirements.replace("_", "-")}
                      </TableCell>
                      <TableCell>{row.contact.tshirtSize ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.outstanding}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.done}</TableCell>
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
                    </TableRow>
                    {expanded === row.contact.id ? (
                      <TableRow key={`${row.contact.id}-details`}>
                        <TableCell colSpan={7} className="bg-muted/20 p-3">
                          <div className="grid max-w-4xl gap-0 border-y">
                            {row.assignments.map((assignment) => (
                              <div
                                key={assignment.assignment.id}
                                className="flex items-center justify-between border-b bg-background px-2.5 py-1.5 text-xs last:border-b-0"
                              >
                                <span>
                                  {assignment.template.title}
                                  {assignment.submission === null
                                    ? ""
                                    : ` · ${assignment.submission.code}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      assignment.assignment.status === "todo"
                                        ? "outline"
                                        : "secondary"
                                    }
                                    className="capitalize"
                                  >
                                    {assignment.assignment.status}
                                  </Badge>
                                  {assignment.assignment.status === "todo" ? (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => waive.mutate(assignment.assignment.id)}
                                    >
                                      Waive
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 px-2.5 py-1.5">
                              <span className="text-xs text-muted-foreground">Manual assign:</span>
                              {data.templates.map((template) => (
                                <Button
                                  key={template.template.id}
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    assign.mutate({
                                      taskTemplateId: template.template.id,
                                      contactId: row.contact.id,
                                    })
                                  }
                                >
                                  {template.template.title}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </TabsContent>
      </Tabs>
      <TaskTemplateDialog
        key={editingId ?? fileRequestId ?? "new"}
        eventId={eventId}
        timezone={timezone}
        data={data}
        templateId={editingId}
        initialFileRequestId={fileRequestId}
        open={drawer}
        onOpenChange={setDrawer}
      />
    </main>
  );
}

export function TaskTemplateDialog({
  eventId,
  timezone,
  data,
  templateId,
  initialFileRequestId,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly templateId: string | null;
  readonly initialFileRequestId: string | undefined;
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
          ? initialFileRequestId === undefined
            ? "manual"
            : `file:${initialFileRequestId}`
          : `file:${existing.fileRequestId}`
        : `form:${existing.portalFormId}`,
    auto: existing?.autoAssignOnAccept ?? true,
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
          portalFormId: form.link.startsWith("form:") ? form.link.slice(5) : null,
          fileRequestId: form.link.startsWith("file:") ? form.link.slice(5) : null,
          autoAssignOnAccept: form.auto,
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
      toast.success("Task template saved");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
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
              </SelectContent>
            </Select>
          </div>
          {form.scope !== "contact" ? null : (
            <div className="grid gap-1.5">
              <Label>Assign speakers</Label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="pressable flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50"
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
                onChange={(contactIds) => setForm({ ...form, contactIds: new Set(contactIds) })}
                title="Assign speakers"
                description="Everyone selected is assigned this task."
              />
            </div>
          )}
          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            Auto-assign on accept
            <Switch checked={form.auto} onCheckedChange={(auto) => setForm({ ...form, auto })} />
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
                    "spotlight-row pressable relative flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
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
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [requirementForm, setRequirementForm] = useState(emptyRequirementForm);
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequestForm);
  const queryClient = useQueryClient();
  const requirements = usePagination(data.requirements);
  const requests = usePagination(data.fileRequests);
  const acceptedSessions = data.submissions.filter(
    (submission) => submission.status === "accepted",
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
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
            <Button size="sm" className="pressable" onClick={() => openRequirement()}>
              <PlusIcon /> Add requirement
            </Button>
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
                  const uploadedSessionIds = new Set(
                    data.files.flatMap((file) =>
                      file.upload.requirementId === requirement.id &&
                      file.upload.submissionId !== null &&
                      data.versions.some(
                        (version) => version.version.fileUploadId === file.upload.id,
                      )
                        ? [file.upload.submissionId]
                        : [],
                    ),
                  );
                  const uploaded = acceptedSessions.filter((session) =>
                    uploadedSessionIds.has(session.id),
                  ).length;
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
                            {uploaded} of {acceptedSessions.length} sessions uploaded
                          </span>
                        </span>
                      </Link>
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
                onClick={() => openRequest()}
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
};

const emptyRequirementForm: RequirementForm = {
  id: null,
  title: "",
  description: "",
  dueAt: "",
  acceptTypes: "",
  maxSizeMb: "",
};

const requirementFormFor = (requirement: AdminData["requirements"][number]): RequirementForm => ({
  id: requirement.id,
  title: requirement.title,
  description: requirement.description,
  dueAt: requirement.dueAt === null ? "" : new Date(requirement.dueAt).toISOString(),
  acceptTypes: requirement.acceptTypes ?? "",
  maxSizeMb: requirement.maxSizeMb?.toString() ?? "",
});

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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
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
  const accept = useMutation({
    mutationFn: (submissionId: string) =>
      acceptPortalSubmission({ data: { eventId, submissionId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Submission accepted and onboarding tasks assigned");
      await refresh();
    },
  });
  const pendingHistory = data.history
    .map((item) => item.history)
    .filter((item) => item.approvalStatus === "pending_review");
  const pendingProfiles = data.profileHistory.filter(
    (item) => item.history.approvalStatus === "pending_review",
  );
  const visibleSubmissions = data.submissions.filter(
    (item) => item.status === "accepted" || item.status === "pending",
  );
  const submissionPages = usePagination(visibleSubmissions, {
    spotlightId,
    getId: (submission) => submission.id,
  });
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={visibleSubmissions.map((submission) => submission.id)}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div>
              <h1 className="text-lg font-semibold">Content</h1>
              <p className="text-xs text-muted-foreground">
                Accepted session content, speakers, and approval history.
              </p>
            </div>
            {visibleSubmissions.length === 0 ? (
              <AdminEmptyState
                icon={FileCheckIcon}
                title="No session content yet"
                description="Accept a submission before speaker content and approvals can appear here."
                action={
                  <Button asChild size="sm" className="pressable">
                    <Link to="/admin/abstracts" search={{ status: "all", spotlight: undefined }}>
                      Review submissions
                    </Link>
                  </Button>
                }
              />
            ) : (
              <>
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
                      total={visibleSubmissions.length}
                      onPageChange={submissionPages.setPage}
                    />
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Status</TableHead>
                        {compact ? null : <TableHead>Speakers</TableHead>}
                        {compact ? null : <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
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
                              <span className="font-mono text-xs tabular-nums">
                                {submission.code}
                              </span>{" "}
                              —{" "}
                              <span className="font-medium">
                                {compact ? (
                                  <span className="inline-block max-w-52 truncate align-bottom">
                                    {submission.title}
                                  </span>
                                ) : (
                                  submission.title
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="h-9 py-1.5">
                              <StatusBadge status={submission.status} />
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
                                {submission.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      accept.mutate(submission.id);
                                    }}
                                  >
                                    <UserRoundCheckIcon /> Accept
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
  const assets = data.requirements.map((requirement) => ({
    requirement,
    file: data.files.find(
      (item) =>
        item.upload.submissionId === submissionId && item.upload.requirementId === requirement.id,
    ),
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
              to="/admin/abstracts/$id"
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
              {assets.map(({ requirement, file }) => {
                const versions = data.versions
                  .map((item) => item.version)
                  .filter((version) => version.fileUploadId === file?.upload.id);
                const comments = data.comments
                  .map((item) => item.comment)
                  .filter((comment) => comment.fileUploadId === file?.upload.id);
                return (
                  <div key={requirement.id}>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{requirement.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {requirement.acceptTypes ?? "Any file type"}
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
    queryKey: ["admin-headshot", current?.id],
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
        {contact.bio === null || contact.bio.length === 0 ? (
          <p className="mt-2 text-xs italic text-muted-foreground/70">No bio yet.</p>
        ) : (
          <div
            className="mt-2 text-xs leading-relaxed text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: contact.bio }}
          />
        )}
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
