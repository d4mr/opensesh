import type { SpeakerCsvRow, SpeakerDirectoryRow } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, DownloadIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { ChangeDiff } from "@/components/app/change-diff";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { profileDiffRows } from "@/lib/content-diff";
import { downloadVersion } from "@/lib/files";
import { cn } from "@/lib/utils";
import { speakerDirectoryQuery } from "@/lib/widget-queries";
import {
  approveProfileChange,
  rejectProfileChange,
  waiveAdminAssignment,
} from "@/server-fns/portal";
import { importSpeakerCsv } from "@/server-fns/widgets";

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

const shortDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));

const hasRichText = (value: string | null) =>
  value !== null && value.replace(/<[^>]*>/g, "").trim().length > 0;

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
    <div className="flex h-8 items-center gap-2 border-b last:border-b-0">
      <span className={cn("size-1.5 shrink-0 rounded-full", readinessToneClass[tone])} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-muted-foreground">{detail}</span>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
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
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function DirectoryData({
  eventId,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
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
      rows={result.data.data.rows}
      csv={result.data.data.csv}
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function Directory({
  eventId,
  rows,
  csv,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
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
  const [copiedEmail, setCopiedEmail] = useState<string>();
  const [waivedIds, setWaivedIds] = useState<ReadonlySet<string>>(new Set());
  const [profileDecisions, setProfileDecisions] = useState<
    ReadonlyMap<string, "approve" | "reject">
  >(new Map());
  const queryClient = useQueryClient();
  const directoryOptions = speakerDirectoryQuery(eventId);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: directoryOptions.queryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] }),
    ]);
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
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        [
          row.contact.firstName,
          row.contact.lastName,
          row.contact.email,
          row.contact.company ?? "",
          ...row.sessions.map((session) => session.title),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );
  const selected = rows.find((row) => row.contact.id === spotlightId);
  const pendingProfile = selected?.profileChanges.find((entry) => !profileDecisions.has(entry.id));
  const reviewedProfile = selected?.profileChanges.find((entry) => profileDecisions.has(entry.id));
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
        clearFilters={() => setSearch("")}
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
                <Button size="sm" variant="outline" className="pressable" onClick={download}>
                  <DownloadIcon /> Export CSV
                </Button>
                <Button size="sm" className="pressable" onClick={() => setImportOpen(true)}>
                  <UploadIcon /> Import CSV
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative min-w-56 flex-1 sm:max-w-sm">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search speakers…"
                  className="h-8 pl-8"
                />
              </div>
              <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                {filtered.length} speaker{filtered.length === 1 ? "" : "s"}
              </p>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Speaker</TableHead>
                    {compact ? null : <TableHead>Sessions</TableHead>}
                    {compact ? null : <TableHead>Dietary</TableHead>}
                    {compact ? null : <TableHead>T-shirt</TableHead>}
                    {compact ? null : <TableHead>Social</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={compact ? 1 : 5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No speakers match.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow
                        key={row.contact.id}
                        ref={rowRef(row.contact.id)}
                        className={cn("h-9 cursor-pointer", rowClassName(row.contact.id))}
                        onClick={() => openSpotlight(row.contact.id)}
                      >
                        <TableCell className="h-9 py-0">
                          <div className="flex items-center gap-2.5">
                            <Headshot row={row} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                {row.contact.firstName} {row.contact.lastName}
                                {row.contact.profileReviewStatus === "pending_review" ? (
                                  <span className="rounded-sm border px-1 py-px text-[10px] font-normal text-[var(--status-pending)]">
                                    Profile pending
                                  </span>
                                ) : null}
                              </p>
                              <p
                                className={cn(
                                  "truncate text-xs text-muted-foreground",
                                  compact && "hidden",
                                )}
                              >
                                {[row.contact.title, row.contact.company]
                                  .filter(Boolean)
                                  .join(" · ") || row.contact.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {compact ? null : (
                          <TableCell className="h-9 py-0 font-mono text-xs tabular-nums">
                            {row.sessions.map((session) => session.code).join(", ") || "—"}
                          </TableCell>
                        )}
                        {compact ? null : (
                          <TableCell className="h-9 py-0 text-xs">
                            {dietaryLabels[row.contact.dietaryRequirements] ??
                              row.contact.dietaryRequirements}
                          </TableCell>
                        )}
                        {compact ? null : (
                          <TableCell className="h-9 py-0 text-xs">
                            {row.contact.tshirtSize ?? "—"}
                          </TableCell>
                        )}
                        {compact ? null : (
                          <TableCell className="h-9 py-0 text-xs text-muted-foreground">
                            {[
                              row.contact.linkedinUrl && "LinkedIn",
                              row.contact.twitterUrl && "Twitter",
                              row.contact.websiteUrl && "Web",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                }
                onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-16 text-xs">
                <p className="mb-4 text-muted-foreground">
                  {[selected.contact.title, selected.contact.company].filter(Boolean).join(" · ") ||
                    selected.contact.email}
                </p>
                <div className="grid gap-5 [&>section]:min-w-0">
                  <section>
                    <SectionLabel>Profile readiness</SectionLabel>
                    <div className="mt-1 border-y">
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
                    {!hasRichText(selected.contact.bio) ? (
                      <p className="mt-2 italic text-muted-foreground">No bio yet.</p>
                    ) : (
                      <div
                        className="rte-content mt-2 border-t pt-2 text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: selected.contact.bio ?? "" }}
                      />
                    )}
                  </section>
                  <section>
                    <SectionLabel>Sessions</SectionLabel>
                    <div className="mt-1 divide-y border-y">
                      {selected.sessions.length === 0 ? (
                        <p className="flex h-8 items-center text-muted-foreground">
                          No sessions attached.
                        </p>
                      ) : (
                        selected.sessions.map((session) => (
                          <Link
                            key={session.id}
                            to="/admin/sessions"
                            search={{ status: "all", spotlight: session.id }}
                            className="pressable flex h-8 min-w-0 items-center gap-2 transition-colors hover:text-foreground"
                          >
                            <span className="shrink-0 font-mono tabular-nums">{session.code}</span>
                            <span className="truncate text-muted-foreground">{session.title}</span>
                          </Link>
                        ))
                      )}
                    </div>
                  </section>
                  <section>
                    <SectionLabel>Tasks</SectionLabel>
                    <div className="mt-1 divide-y border-y">
                      {selected.tasks.length === 0 ? (
                        <p className="flex h-8 items-center text-muted-foreground">
                          No tasks assigned.
                        </p>
                      ) : (
                        selected.tasks.map((task) => {
                          const status = waivedIds.has(task.id) ? "waived" : task.status;
                          return (
                            <div key={task.id} className="flex h-8 min-w-0 items-center gap-2">
                              <span className="min-w-0 flex-1 truncate">
                                {task.title}
                                {task.submissionCode === null ? null : (
                                  <span className="ml-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                                    {task.submissionCode}
                                  </span>
                                )}
                              </span>
                              <Badge
                                variant={status === "todo" ? "outline" : "secondary"}
                                className="h-5 rounded-sm px-1.5 text-[10px] font-normal"
                              >
                                {taskStatusLabels[status]}
                              </Badge>
                              <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                                {task.dueDate === null ? "No due" : shortDate(task.dueDate)}
                              </span>
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
                    <div className="mt-1 divide-y border-y">
                      {selected.files.length === 0 ? (
                        <p className="flex h-8 items-center text-muted-foreground">No files yet.</p>
                      ) : (
                        selected.files.map((file) => (
                          <div key={file.id} className="flex h-8 min-w-0 items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{file.filename}</p>
                              <p className="truncate text-[10px] leading-none text-muted-foreground">
                                {file.label}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                              {shortDate(file.uploadedAt)}
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
                    <div className="mt-1 divide-y border-y">
                      {selected.emails.length === 0 ? (
                        <p className="flex h-8 items-center text-muted-foreground">
                          No emails sent.
                        </p>
                      ) : (
                        selected.emails.map((email) => (
                          <Link
                            key={email.id}
                            to="/admin/emails"
                            search={{ email: email.id }}
                            className="pressable flex h-8 min-w-0 items-center gap-2 transition-colors hover:text-foreground"
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
                              {email.sentAt === null ? "—" : shortDate(email.sentAt)}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </section>
                  {pendingProfile === undefined ? null : (
                    <section>
                      <div className="flex items-center justify-between gap-2">
                        <SectionLabel>Profile changes</SectionLabel>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {shortDate(pendingProfile.createdAt)}
                        </span>
                      </div>
                      <ChangeDiff
                        rows={profileDiffRows(pendingProfile)}
                        className="mt-2 border-y py-2"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="pressable"
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
                </div>
              </div>
            </div>
          )
        }
      />
      <CsvImport eventId={eventId} open={importOpen} close={() => setImportOpen(false)} />
    </main>
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
  return row.contact.headshotUrl === null ? (
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
    <img
      src={row.contact.headshotUrl}
      alt=""
      className={cn("shrink-0 rounded-md object-cover", classes)}
    />
  );
}

interface PreviewRow {
  readonly number: number;
  readonly row: SpeakerCsvRow;
  readonly errors: ReadonlyArray<string>;
}
interface Preview {
  readonly headers: ReadonlyArray<string>;
  readonly mapping: ReadonlyArray<{ header: string; field: string }>;
  readonly rows: ReadonlyArray<PreviewRow>;
}
const aliases: Readonly<Record<string, keyof SpeakerCsvRow>> = {
  firstname: "firstName",
  first: "firstName",
  lastname: "lastName",
  last: "lastName",
  email: "email",
  emailaddress: "email",
  title: "title",
  jobtitle: "title",
  company: "company",
  organization: "company",
  bio: "bio",
  biography: "bio",
  dietary: "dietary",
  dietaryrequirements: "dietary",
  tshirt: "tshirt",
  tshirtsize: "tshirt",
  linkedin: "linkedin",
  linkedinurl: "linkedin",
  twitter: "twitter",
  x: "twitter",
  twitterurl: "twitter",
  facebook: "facebook",
  facebookurl: "facebook",
  website: "website",
  websiteurl: "website",
  phone: "phone",
  phonenumber: "phone",
};
const parseCells = (text: string) => {
  const rows: Array<Array<string>> = [[]];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      rows.at(-1)?.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(cell);
      cell = "";
      rows.push([]);
    } else cell += char;
  }
  rows.at(-1)?.push(cell);
  return rows.filter((row) => row.some((value) => value.trim() !== ""));
};
const parsePreview = (text: string): Preview => {
  const cells = parseCells(text);
  const headers = cells[0]?.map((value) => value.trim()) ?? [];
  const mapping = headers.flatMap((header, index) => {
    const field = aliases[header.toLowerCase().replace(/[^a-z0-9]/g, "")];
    return field === undefined ? [] : [{ header, field, index }];
  });
  const rows = cells.slice(1).map((values, index) => {
    const valueFor = (field: keyof SpeakerCsvRow) => {
      const match = mapping.find((item) => item.field === field);
      return match === undefined ? "" : (values[match.index]?.trim() ?? "");
    };
    const nullable = (field: keyof SpeakerCsvRow) => valueFor(field) || null;
    const row: SpeakerCsvRow = {
      firstName: valueFor("firstName"),
      lastName: valueFor("lastName"),
      email: valueFor("email"),
      title: nullable("title"),
      company: nullable("company"),
      bio: nullable("bio"),
      dietary: valueFor("dietary") || "none",
      tshirt: nullable("tshirt"),
      linkedin: nullable("linkedin"),
      twitter: nullable("twitter"),
      facebook: nullable("facebook"),
      website: nullable("website"),
      phone: nullable("phone"),
    };
    const errors = [
      row.firstName === "" ? "First name is required" : null,
      row.lastName === "" ? "Last name is required" : null,
      !row.email.includes("@") ? "Valid email is required" : null,
    ].filter((value): value is string => value !== null);
    return { number: index + 2, row, errors };
  });
  return { headers, mapping: mapping.map(({ header, field }) => ({ header, field })), rows };
};

function CsvImport({
  eventId,
  open,
  close,
}: {
  readonly eventId: string;
  readonly open: boolean;
  readonly close: () => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview>();
  const mutation = useMutation({
    mutationFn: (rows: ReadonlyArray<SpeakerCsvRow>) =>
      importSpeakerCsv({ data: { eventId, rows } }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: speakerDirectoryQuery(eventId).queryKey });
      setPreview(undefined);
      close();
    },
  });
  const errors = preview?.rows.reduce((total, row) => total + row.errors.length, 0) ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setPreview(undefined);
          close();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import speakers from CSV</DialogTitle>
          <DialogDescription>
            Headers are matched without regard to case, spacing, underscores, or column order.
            Existing event contacts are updated by email.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) setPreview(parsePreview(await file.text()));
          }}
        />
        {preview === undefined ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="pressable rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground hover:bg-muted/40"
          >
            <UploadIcon className="mx-auto mb-2 size-5" />
            Choose speakers.csv
          </button>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {preview.mapping.map((item) => (
                <span
                  key={`${item.header}-${item.field}`}
                  className="rounded-md border px-1.5 py-0.5 text-[11px]"
                >
                  {item.header} → {item.field}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 5).map((item) => (
                    <TableRow key={item.number}>
                      <TableCell className="tabular-nums">{item.number}</TableCell>
                      <TableCell>
                        {item.row.firstName} {item.row.lastName}
                      </TableCell>
                      <TableCell>{item.row.email}</TableCell>
                      <TableCell>{item.row.company ?? "—"}</TableCell>
                      <TableCell
                        className={
                          item.errors.length > 0
                            ? "text-destructive"
                            : "text-[var(--status-accepted)]"
                        }
                      >
                        {item.errors.join("; ") || "Ready"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(5, preview.rows.length)} of {preview.rows.length} rows ·{" "}
              {errors === 0
                ? "All rows ready"
                : `${errors} validation error${errors === 1 ? "" : "s"}`}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          {preview === undefined ? null : (
            <Button
              disabled={preview.rows.length === 0 || errors > 0 || mutation.isPending}
              onClick={() => mutation.mutate(preview.rows.map((item) => item.row))}
            >
              {mutation.isPending ? "Importing…" : `Import ${preview.rows.length} speakers`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
