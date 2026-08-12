import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { DownloadIcon, FileArchiveIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RichText } from "@/components/forms/rich-text";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
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
} from "@/components/ui/dialog";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
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
import { adminPortalQuery } from "@/lib/portal-queries";
import { downloadVersion } from "@/lib/files";
import { cn } from "@/lib/utils";
import { exportAdminFilesZip, getPortalAdmin } from "@/server-fns/portal";
import { sendDeliverableReminders } from "@/server-fns/mail";

type AdminData = Extract<Awaited<ReturnType<typeof getPortalAdmin>>, { readonly ok: true }>["data"];
type AdminFile = AdminData["files"][number];
type AdminContact = AdminData["participants"][number]["contact"];
type AdminSubmission = AdminData["submissions"][number];
type AdminVersion = AdminData["versions"][number]["version"];

interface LibraryRow {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly status: "uploaded" | "outstanding";
  readonly deliverableId: string | null;
  readonly requirementAssignmentId: string | null;
  readonly file: AdminFile | undefined;
  readonly submission: AdminSubmission | null;
  readonly contacts: ReadonlyArray<AdminContact>;
  readonly latest: AdminVersion | undefined;
  readonly versionCount: number;
  readonly date: Date | null;
}

const latestVersion = (data: AdminData, uploadId: string | undefined) => {
  if (uploadId === undefined) return undefined;
  return data.versions
    .map((item) => item.version)
    .filter((version) => version.fileUploadId === uploadId)
    .sort(
      (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
    )[0];
};

const uniqueContacts = (contacts: ReadonlyArray<AdminContact>) =>
  Array.from(new Map(contacts.map((contact) => [contact.id, contact])).values());

const buildRows = (data: AdminData): ReadonlyArray<LibraryRow> => {
  const rows: Array<LibraryRow> = [];
  const usedUploads = new Set<string>();

  for (const assignment of data.requirementAssignments) {
    const file = data.files.find(
      (candidate) => candidate.upload.assignmentId === assignment.assignment.id,
    );
    if (file !== undefined) usedUploads.add(file.upload.id);
    const latest = latestVersion(data, file?.upload.id);
    const speakers =
      assignment.contact === null
        ? uniqueContacts(
            data.participants
              .filter((participant) => participant.submission.id === assignment.submission.id)
              .map((participant) => participant.contact),
          )
        : [assignment.contact];
    rows.push({
      id: `requirement-assignment:${assignment.assignment.id}`,
      label: latest?.filename ?? assignment.requirement.title,
      kind: assignment.requirement.title,
      status: assignment.assignment.status,
      deliverableId: `requirement:${assignment.requirement.id}`,
      requirementAssignmentId: assignment.assignment.id,
      file,
      submission: assignment.submission,
      contacts: speakers,
      latest,
      versionCount: data.versions.filter(
        (version) => version.version.fileUploadId === file?.upload.id,
      ).length,
      date:
        latest === undefined
          ? assignment.requirement.dueAt === null
            ? null
            : new Date(assignment.requirement.dueAt)
          : new Date(latest.uploadedAt),
    });
  }

  for (const assignment of data.assignments) {
    if (assignment.template.fileRequestId === null) continue;
    const request = data.fileRequests.find(
      (candidate) => candidate.id === assignment.template.fileRequestId,
    );
    if (request === undefined) continue;
    const contactsForTarget =
      assignment.contact === null
        ? uniqueContacts(
            data.participants
              .filter(
                (participant) => participant.submission.id === assignment.assignment.submissionId,
              )
              .map((participant) => participant.contact),
          )
        : [assignment.contact];
    for (const contact of contactsForTarget) {
      const file = data.files.find(
        (candidate) =>
          candidate.upload.fileRequestId === request.id &&
          candidate.upload.contactId === contact.id &&
          candidate.upload.submissionId === assignment.assignment.submissionId,
      );
      if (file !== undefined) usedUploads.add(file.upload.id);
      const latest = latestVersion(data, file?.upload.id);
      rows.push({
        id: `assignment:${assignment.assignment.id}:${contact.id}`,
        label: latest?.filename ?? request.title,
        kind: request.title,
        status: latest === undefined ? "outstanding" : "uploaded",
        deliverableId: `request:${request.id}`,
        requirementAssignmentId: null,
        file,
        submission: assignment.submission,
        contacts: [contact],
        latest,
        versionCount: data.versions.filter(
          (version) => version.version.fileUploadId === file?.upload.id,
        ).length,
        date:
          latest === undefined
            ? assignment.template.dueDate === null
              ? null
              : new Date(assignment.template.dueDate)
            : new Date(latest.uploadedAt),
      });
    }
  }

  for (const file of data.files) {
    if (usedUploads.has(file.upload.id)) continue;
    const latest = latestVersion(data, file.upload.id);
    rows.push({
      id: `upload:${file.upload.id}`,
      label: latest?.filename ?? file.request?.title ?? "File",
      kind:
        file.request?.title ??
        (file.upload.kind === "headshot"
          ? "Headshot"
          : file.upload.kind === "slides"
            ? "Slides"
            : "File request"),
      status: latest === undefined ? "outstanding" : "uploaded",
      deliverableId:
        file.upload.requirementId === null
          ? file.upload.fileRequestId === null
            ? null
            : `request:${file.upload.fileRequestId}`
          : `requirement:${file.upload.requirementId}`,
      requirementAssignmentId: file.upload.assignmentId,
      file,
      submission: file.submission,
      contacts: [file.contact],
      latest,
      versionCount: data.versions.filter(
        (version) => version.version.fileUploadId === file.upload.id,
      ).length,
      date: latest === undefined ? null : new Date(latest.uploadedAt),
    });
  }

  return rows.sort((left, right) => {
    if (left.status !== right.status) return left.status === "outstanding" ? -1 : 1;
    return (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0);
  });
};

export function FilesLibrary({
  spotlightId,
  deliverableId,
}: {
  readonly spotlightId: string | undefined;
  readonly deliverableId: string | undefined;
}) {
  const context = useAdminEvent();
  const navigate = useNavigate({ from: "/admin/files" });
  if (context === null) return null;
  return (
    <FilesLibraryData
      eventId={context.event.id}
      timezone={context.event.timezone}
      spotlightId={spotlightId}
      deliverableId={deliverableId}
      setSearch={(next) =>
        void navigate({
          search: { spotlight: next.spotlight, deliverable: next.deliverable },
          replace: true,
        })
      }
    />
  );
}

function FilesLibraryData({
  eventId,
  timezone,
  spotlightId,
  deliverableId,
  setSearch,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly spotlightId: string | undefined;
  readonly deliverableId: string | undefined;
  readonly setSearch: (search: {
    readonly spotlight: string | undefined;
    readonly deliverable: string | undefined;
  }) => void;
}) {
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  const [sessionId, setSessionId] = useState("all");
  const [contactId, setContactId] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [grouping, setGrouping] = useState<"session" | "speaker">("session");
  const [ready, setReady] = useState<{
    readonly filename: string;
    readonly contentType: string;
    readonly count: number;
    readonly base64: string;
  }>();
  const [exportError, setExportError] = useState<string>();
  if (!portal.data.ok) return <p className="p-6 text-sm">{portal.data.error.message}</p>;
  const data = portal.data.data;
  const rows = buildRows(data);
  const filtered = rows.filter(
    (row) =>
      (deliverableId === undefined || row.deliverableId === deliverableId) &&
      (sessionId === "all" || row.submission?.id === sessionId) &&
      (contactId === "all" || row.contacts.some((contact) => contact.id === contactId)) &&
      (status === "all" || row.status === status),
  );
  const uploadedIds = filtered.flatMap((row) =>
    row.file === undefined || row.latest === undefined ? [] : [row.file.upload.id],
  );
  const reminderRecipientIds = filtered.flatMap((row) =>
    row.status !== "outstanding" || row.requirementAssignmentId === null
      ? []
      : row.contacts.flatMap((contact) =>
          contactId === "all" || contact.id === contactId ? [contact.id] : [],
        ),
  );
  const reminderContactIds = Array.from(new Set(reminderRecipientIds));
  const filteredRequirementId = deliverableId?.startsWith("requirement:")
    ? deliverableId.slice("requirement:".length)
    : undefined;
  const allUploadedSelected = uploadedIds.length > 0 && uploadedIds.every((id) => selected.has(id));
  const selectedRow = rows.find((row) => row.id === spotlightId);
  const sessions = Array.from(
    new Map(
      rows.flatMap((row) =>
        row.submission === null ? [] : [[row.submission.id, row.submission] as const],
      ),
    ).values(),
  );
  const speakers = Array.from(
    new Map(
      rows.flatMap((row) => row.contacts.map((contact) => [contact.id, contact] as const)),
    ).values(),
  ).sort((left, right) => left.lastName.localeCompare(right.lastName));
  const clearFilters = () => {
    setSessionId("all");
    setContactId("all");
    setStatus("all");
    setSearch({ spotlight: undefined, deliverable: undefined });
  };
  const pagination = usePagination(filtered, {
    resetKey: `${deliverableId ?? "all"}:${sessionId}:${contactId}:${status}`,
    spotlightId,
    getId: (row) => row.id,
  });
  const exportZip = useMutation({
    mutationFn: () =>
      exportAdminFilesZip({
        data: { eventId, uploadIds: Array.from(selected), grouping },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        setExportError(result.error.message);
        return;
      }
      setReady(result.data);
      setExportError(undefined);
    },
  });
  const queryClient = useQueryClient();
  const remind = useMutation({
    mutationFn: () =>
      sendDeliverableReminders({
        data: {
          eventId,
          contactIds: reminderContactIds,
          ...(filteredRequirementId === undefined ? {} : { requirementId: filteredRequirementId }),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Queued ${result.data.attempted} reminders`);
      await invalidateAfterMutation(queryClient, eventId);
    },
  });
  const downloadReady = () => {
    if (ready === undefined) return;
    const binary = atob(ready.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: ready.contentType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ready.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={filtered.map((row) => row.id)}
        onSpotlightChange={(id) => setSearch({ spotlight: id, deliverable: deliverableId })}
        clearFilters={clearFilters}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">Files</h1>
                <p className="text-xs text-muted-foreground">
                  Every upload target, latest version, and review thread in one place.
                </p>
              </div>
              <Button
                size="sm"
                className="pressable"
                disabled={selected.size === 0}
                onClick={() => {
                  setReady(undefined);
                  setExportError(undefined);
                  setExportOpen(true);
                }}
              >
                <FileArchiveIcon /> Export ZIP ({selected.size})
              </Button>
            </div>
            {rows.length === 0 ? (
              <AdminEmptyState
                icon={FileArchiveIcon}
                title="No file requests yet"
                description="Create a deliverable before speaker uploads can appear here."
                action={
                  <Button asChild size="sm" className="pressable">
                    <Link
                      to="/admin/$section"
                      params={{ section: "file-requests" }}
                      search={{ spotlight: undefined, fileRequest: undefined }}
                    >
                      Create deliverable
                    </Link>
                  </Button>
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger size="sm" className="w-48">
                      <SelectValue placeholder="Session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.code} — {session.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger size="sm" className="w-44">
                      <SelectValue placeholder="Speaker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All speakers</SelectItem>
                      {speakers.map((speaker) => (
                        <SelectItem key={speaker.id} value={speaker.id}>
                          {speaker.firstName} {speaker.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="uploaded">Uploaded</SelectItem>
                      <SelectItem value="outstanding">Outstanding</SelectItem>
                    </SelectContent>
                  </Select>
                  {deliverableId === undefined &&
                  sessionId === "all" &&
                  contactId === "all" &&
                  status === "all" ? null : (
                    <Button size="sm" variant="ghost" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                  {status === "outstanding" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="pressable"
                      disabled={reminderRecipientIds.length === 0 || remind.isPending}
                      onClick={() => remind.mutate()}
                    >
                      <SendIcon /> Remind outstanding ({reminderRecipientIds.length})
                    </Button>
                  ) : null}
                  <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {filtered.length} record{filtered.length === 1 ? "" : "s"}
                  </p>
                </div>
                <TableShell
                  scrollRef={scrollRef}
                  footer={
                    <PaginationFooter
                      page={pagination.page}
                      pageSize={pagination.pageSize}
                      total={filtered.length}
                      onPageChange={pagination.setPage}
                    />
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-9">
                          <Checkbox
                            aria-label="Select all uploaded files"
                            checked={
                              allUploadedSelected
                                ? true
                                : uploadedIds.some((id) => selected.has(id))
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) =>
                              setSelected((current) => {
                                const next = new Set(current);
                                for (const id of uploadedIds) {
                                  if (checked === true) next.add(id);
                                  else next.delete(id);
                                }
                                return next;
                              })
                            }
                          />
                        </TableHead>
                        <TableHead>File</TableHead>
                        {compact ? null : <TableHead>Session</TableHead>}
                        {compact ? null : <TableHead>Speaker</TableHead>}
                        <TableHead>Kind</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        {compact ? null : <TableHead className="text-right">Versions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.pageItems.map((row) => (
                        <TableRow
                          key={row.id}
                          ref={rowRef(row.id)}
                          className={cn("h-9 cursor-pointer", rowClassName(row.id))}
                          onClick={() => openSpotlight(row.id)}
                        >
                          <TableCell
                            className="h-9 py-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              aria-label={`Select ${row.label}`}
                              disabled={row.file === undefined || row.latest === undefined}
                              checked={row.file !== undefined && selected.has(row.file.upload.id)}
                              onCheckedChange={(checked) => {
                                if (row.file === undefined) return;
                                const uploadId = row.file.upload.id;
                                setSelected((current) => {
                                  const next = new Set(current);
                                  if (checked === true) next.add(uploadId);
                                  else next.delete(uploadId);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="h-9 max-w-60 truncate py-1 font-medium">
                            {row.label}
                          </TableCell>
                          {compact ? null : (
                            <TableCell className="h-9 max-w-52 truncate py-1">
                              {row.submission === null ? (
                                "—"
                              ) : (
                                <>
                                  <span className="font-mono text-xs tabular-nums">
                                    {row.submission.code}
                                  </span>{" "}
                                  · {row.submission.title}
                                </>
                              )}
                            </TableCell>
                          )}
                          {compact ? null : (
                            <TableCell className="h-9 max-w-44 py-1">
                              {row.contacts.length === 0 ? (
                                "—"
                              ) : (
                                <span className="flex flex-wrap gap-1">
                                  {row.contacts.map((contact) => (
                                    <SpeakerBadge
                                      key={contact.id}
                                      person={{
                                        id: contact.id,
                                        name: `${contact.firstName} ${contact.lastName}`,
                                        image: contact.headshotUrl,
                                      }}
                                    />
                                  ))}
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="h-9 py-1">{row.kind}</TableCell>
                          <TableCell className="h-9 py-1 text-xs text-muted-foreground tabular-nums">
                            {row.date === null ? (
                              "—"
                            ) : (
                              <Timestamp value={row.date} timezone={timezone} mode="date" />
                            )}
                          </TableCell>
                          <TableCell className="h-9 py-1">
                            <Badge
                              className={
                                row.status === "uploaded"
                                  ? "bg-status-accepted text-status-accepted-foreground"
                                  : "bg-status-pending text-status-pending-foreground"
                              }
                            >
                              {row.status === "uploaded" ? "Uploaded" : "Outstanding"}
                            </Badge>
                          </TableCell>
                          {compact ? null : (
                            <TableCell className="h-9 py-1 text-right tabular-nums">
                              {row.versionCount}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableShell>
              </>
            )}
          </div>
        )}
        panel={
          <FileSpotlight
            eventId={eventId}
            timezone={timezone}
            data={data}
            row={selectedRow}
            onClose={() => setSearch({ spotlight: undefined, deliverable: deliverableId })}
          />
        }
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export selected files</DialogTitle>
            <DialogDescription>
              The ZIP includes only the latest version of each of the {selected.size} selected
              files.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium">Group folders by</span>
            <Select
              value={grouping}
              onValueChange={(value) => {
                setGrouping(value === "speaker" ? "speaker" : "session");
                setReady(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="session">Session code</SelectItem>
                <SelectItem value="speaker">Speaker name</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {exportError === undefined ? null : (
            <p className="text-xs text-destructive" role="alert">
              {exportError}
            </p>
          )}
          {ready === undefined ? null : (
            <p className="text-xs text-[var(--status-accepted)]" aria-live="polite">
              Ready · {ready.count} latest version{ready.count === 1 ? "" : "s"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            {ready === undefined ? (
              <Button disabled={exportZip.isPending} onClick={() => exportZip.mutate()}>
                <FileArchiveIcon /> {exportZip.isPending ? "Generating…" : "Generate ZIP"}
              </Button>
            ) : (
              <Button onClick={downloadReady}>
                <DownloadIcon /> Download ZIP
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FileSpotlight({
  eventId,
  timezone,
  data,
  row,
  onClose,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: AdminData;
  readonly row: LibraryRow | undefined;
  readonly onClose: () => void;
}) {
  if (row === undefined) return null;
  const upload = row.file?.upload;
  const deliverableRef = row.deliverableId?.split(":") ?? [];
  const requirement = data.requirements.find(
    (item) =>
      item.id ===
      (upload?.requirementId ?? (deliverableRef[0] === "requirement" ? deliverableRef[1] : null)),
  );
  const request = data.fileRequests.find(
    (item) =>
      item.id ===
      (upload?.fileRequestId ?? (deliverableRef[0] === "request" ? deliverableRef[1] : null)),
  );
  const linkedTask = data.templates.find(
    (item) => item.template.fileRequestId === request?.id,
  )?.template;
  const versions =
    upload === undefined
      ? []
      : data.versions
          .map((item) => item.version)
          .filter((version) => version.fileUploadId === upload.id);
  const comments =
    upload === undefined
      ? []
      : data.comments
          .map((item) => item.comment)
          .filter((comment) => comment.fileUploadId === upload.id);
  const latest = row.latest;
  const dueAt = requirement?.dueAt ?? request?.dueAt ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={<span className="truncate text-sm font-medium">{row.label}</span>}
        status={
          <Badge
            className={
              row.status === "uploaded"
                ? "bg-status-accepted text-status-accepted-foreground"
                : "bg-status-pending text-status-pending-foreground"
            }
          >
            {row.status === "uploaded" ? "Uploaded" : "Outstanding"}
          </Badge>
        }
        actions={
          latest === undefined ? undefined : (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="pressable"
              onClick={async () => {
                const result = await downloadVersion(latest.id);
                if (result !== undefined && !result.ok) toast.error(result.error.message);
              }}
            >
              <DownloadIcon /> Download
            </Button>
          )
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-16">
        <div className="grid gap-5">
          <section>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Properties
            </p>
            <dl className="divide-y overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">Deliverable</dt>
                <dd className="text-sm font-medium">
                  {requirement?.title ?? request?.title ?? row.kind}
                </dd>
              </div>
              <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">Due</dt>
                <dd className="text-sm">
                  {dueAt === null ? (
                    "No due date"
                  ) : (
                    <Timestamp value={dueAt} timezone={timezone} mode="date" />
                  )}
                </dd>
              </div>
              {requirement === undefined ? (
                <>
                  <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                    <dt className="text-xs text-muted-foreground">Audience</dt>
                    <dd className="text-sm">
                      {request?.targetType === "submission" ? "Per session" : "Per speaker"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                    <dt className="text-xs text-muted-foreground">Linked task</dt>
                    <dd className="text-sm">{linkedTask?.title ?? "No linked task"}</dd>
                  </div>
                  {request?.instructions ? (
                    <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">Instructions</dt>
                      <dd>
                        <RichText markdown={request.instructions} className="text-sm" />
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="grid grid-cols-[112px_1fr] gap-3 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">File limits</dt>
                  <dd className="text-sm">
                    {requirement.acceptTypes ?? "Any type"} ·{" "}
                    {requirement.maxSizeMb === null ? "Any size" : `${requirement.maxSizeMb} MB`}
                  </dd>
                </div>
              )}
              {row.submission === null ? null : (
                <div className="grid grid-cols-[112px_1fr] items-center gap-3 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Session</dt>
                  <dd className="min-w-0 text-sm">
                    <Link
                      to="/admin/sessions"
                      search={{ state: "all", spotlight: row.submission.id }}
                      className="pressable inline-flex max-w-full items-baseline gap-1.5 truncate hover:underline"
                    >
                      <span className="font-mono text-xs tabular-nums">{row.submission.code}</span>
                      <span className="truncate">{row.submission.title}</span>
                    </Link>
                  </dd>
                </div>
              )}
              {row.contacts.length === 0 ? null : (
                <div className="grid grid-cols-[112px_1fr] items-center gap-3 px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">
                    Speaker{row.contacts.length === 1 ? "" : "s"}
                  </dt>
                  <dd className="flex min-w-0 flex-wrap gap-1.5">
                    {row.contacts.map((contact) => (
                      <SpeakerBadge
                        key={contact.id}
                        linkToSpotlight
                        person={{
                          id: contact.id,
                          name: `${contact.firstName} ${contact.lastName}`,
                          image: contact.headshotUrl,
                        }}
                      />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </section>
          {upload === undefined ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No upload yet. It will appear here once the speaker submits the file.
            </p>
          ) : (
            <FileThread
              eventId={eventId}
              timezone={timezone}
              authorName={data.currentUserName}
              upload={upload}
              versions={versions}
              comments={comments}
              embedded
            />
          )}
        </div>
      </div>
    </div>
  );
}
