import type { FormAnswers, FormFieldDefinition } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  HistoryIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { Timestamp } from "@/components/app/timestamp";
import { FormRenderer } from "@/components/forms/form-renderer";
import { RichText } from "@/components/forms/rich-text";
import { FileThread } from "@/components/portal/file-thread";
import { SessionFileUploadAction } from "@/components/portal/session-file-upload-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { contentDiffRows, describeChangedFields } from "@/lib/content-diff";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelPortalSession,
  editPortalSubmission,
  restorePortalHistory,
  withdrawPortalSubmission,
} from "@/server-fns/portal";

export function PortalSubmissions({
  spotlightId,
  onSpotlightChange,
}: {
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const portal = useSuspenseQuery(speakerPortalQuery);
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  return (
    <SubmissionContent
      data={portal.data.data}
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function SubmissionContent({
  data,
  spotlightId,
  onSpotlightChange,
}: {
  readonly data: Extract<
    Awaited<ReturnType<typeof import("@/server-fns/portal").getSpeakerPortal>>,
    { readonly ok: true }
  >["data"];
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}) {
  const queryClient = useQueryClient();
  const selected = data.submissions.find((item) => item.submission.id === spotlightId);
  const fields = useMemo(
    () =>
      data.fields
        .map((item) => item.field)
        .filter(
          (field) =>
            field.formId === selected?.submission.sourceFormId && field.section === "abstract",
        ),
    [data.fields, selected?.submission.sourceFormId],
  );
  const initialAnswers = useMemo(
    () =>
      selected === undefined
        ? {}
        : answersForSubmission(
            selected.submission,
            fields,
            data.trackIds
              .filter((item) => item.submissionId === selected.submission.id)
              .map((item) => item.id),
            data.tagIds
              .filter((item) => item.submissionId === selected.submission.id)
              .map((item) => item.id),
          ),
    [data.tagIds, data.trackIds, fields, selected],
  );
  // Drafts are keyed by submission so the form hydrates synchronously on
  // spotlight open/swap; TanStack Form only reads answers at mount.
  const [draftAnswers, setDraftAnswers] = useState<Record<string, FormAnswers>>({});
  const answers =
    (selected === undefined ? undefined : draftAnswers[selected.submission.id]) ?? initialAnswers;
  const setAnswers = (next: FormAnswers) => {
    if (selected === undefined) return;
    setDraftAnswers((previous) => ({ ...previous, [selected.submission.id]: next }));
  };
  const invalidate = () => invalidateAfterMutation(queryClient);
  const edit = useMutation({
    mutationFn: () =>
      selected === undefined
        ? Promise.resolve(null)
        : editPortalSubmission({ data: { submissionId: selected.submission.id, answers } }),
    onSuccess: async (result) => {
      if (result === null) return;
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        result.data.contentReviewStatus === "pending_review"
          ? "Changes sent for approval"
          : "Submission saved",
      );
      setDraftAnswers({});
      await invalidate();
    },
  });
  const withdraw = useMutation({
    mutationFn: () =>
      selected === undefined
        ? Promise.resolve(null)
        : withdrawPortalSubmission({ data: { submissionId: selected.submission.id } }),
    onSuccess: async (result) => {
      if (result === null) return;
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Submission withdrawn");
      await invalidate();
    },
  });
  // A speaker cancelling their accepted session is a different act from
  // withdrawing a proposal under review — it goes through the session
  // cancellation flow (organizers are the recorded recipients of the "why").
  const [cancelMessage, setCancelMessage] = useState("");
  const cancelSession = useMutation({
    mutationFn: () =>
      selected === undefined
        ? Promise.resolve(null)
        : cancelPortalSession({
            data: { submissionId: selected.submission.id, message: cancelMessage },
          }),
    onSuccess: async (result) => {
      if (result === null) return;
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Session cancelled — the organizers have been notified");
      setCancelMessage("");
      await invalidate();
    },
  });
  const restore = useMutation({
    mutationFn: (historyId: string) => restorePortalHistory({ data: { historyId } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        result.data.contentReviewStatus === "pending_review"
          ? "Restore sent for approval"
          : "Version restored",
      );
      setDraftAnswers({});
      await invalidate();
    },
  });
  if (data.submissions.length === 0)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        No submissions yet.
      </main>
    );
  const closed =
    selected !== undefined &&
    selected.form !== null &&
    (selected.form.status === "closed" ||
      (selected.form.closeDate !== null && new Date(selected.form.closeDate) <= new Date()));
  const history = data.history
    .map((item) => item.history)
    .filter((item) => item.submissionId === selected?.submission.id);

  // A speaker has a handful of submissions at most — no split layout. The
  // list is a set of rich cards; opening one takes over the page with a
  // breadcrumb back, the same shape as the CRM contact detail.
  if (selected === undefined) {
    return (
      <main className="h-[calc(100svh-3rem)] overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <h1 className="text-xl font-semibold tracking-tight">My submissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.submissions.length === 1
              ? "Your proposal"
              : `Your ${data.submissions.length} proposals`}{" "}
            for {data.event.name}. Open one to edit content, upload files, and follow changes.
          </p>
          <div className="mt-6 grid gap-3 pb-10">
            {data.submissions.map(({ submission, format }) => {
              const assignments = data.requirementAssignments.filter(
                (assignment) => assignment.submissionId === submission.id,
              );
              const fileTotal = assignments.length;
              const uploaded =
                submission.status === "accepted" && fileTotal > 0
                  ? assignments.filter((assignment) => assignment.status === "uploaded").length
                  : null;
              return (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() =>
                    onSpotlightChange(submission.id, { replace: false, keyboard: false })
                  }
                  className="pressable group w-full rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {submission.code}
                    </span>
                    <StatusBadge status={submission.status} />
                    {submission.cancelledAt !== null ? (
                      <span className="rounded-md border border-destructive/40 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                        Session cancelled
                      </span>
                    ) : null}
                    {submission.contentReviewStatus === "pending_review" ? (
                      <span className="rounded-md bg-[var(--status-pending-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-pending)]">
                        Edits pending approval
                      </span>
                    ) : null}
                    <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
                  </div>
                  <h2 className="mt-2.5 text-base font-semibold tracking-tight">
                    {submission.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format?.name ?? "Format pending"}
                    {uploaded === null ? null : (
                      <>
                        {" "}
                        · {uploaded} of {fileTotal} file{fileTotal === 1 ? "" : "s"} uploaded
                      </>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  const sessionCancelled = selected.submission.cancelledAt !== null;
  // Withdrawing is a proposal-stage act; once accepted, the exit is
  // cancelling the session (which notifies the organizers), and a cancelled
  // session offers no further action from here.
  const withdrawAction = ["draft", "pending", "maybe"].includes(selected.submission.status) ? (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Withdraw submission
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw {selected.submission.code}?</DialogTitle>
          <DialogDescription>
            This removes the submission from consideration. Its history remains available.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => withdraw.mutate()}>
              Withdraw
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : selected.submission.status === "accepted" && !sessionCancelled ? (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Cancel my session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel your session?</DialogTitle>
          <DialogDescription>
            {selected.submission.code} comes off the program and the organizers are notified. If
            plans change, they can reinstate it for you.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={cancelMessage}
          onChange={(event) => setCancelMessage(event.target.value)}
          placeholder="Let the organizers know why (optional)"
          className="min-h-20 resize-none text-sm"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep session</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={() => cancelSession.mutate()}>
              Cancel session
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <main className="h-[calc(100svh-3rem)] overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <button
          type="button"
          onClick={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
          className="pressable -ml-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" /> My submissions
        </button>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {selected.submission.code}
          </span>
          <StatusBadge status={selected.submission.status} />
          <span className="text-xs text-muted-foreground">
            {selected.format?.name ?? "Format pending"}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{selected.submission.title}</h1>
        {sessionCancelled ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
            {selected.submission.cancelledBy === "speaker"
              ? "You cancelled this session. If your plans change, contact the organizers to reinstate it."
              : "The organizers cancelled this session. Reach out to them if you have questions."}
          </div>
        ) : null}
        {selected.submission.contentReviewStatus === "pending_review" ? (
          <div className="mt-4 rounded-md border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)] px-3 py-2 text-xs text-[var(--status-pending)]">
            Your content changes are pending organizer approval. The last approved version remains
            public.
          </div>
        ) : null}
        <div className="pb-16">
          <Tabs defaultValue="details" className="mt-6">
            <TabsList variant="line">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History ({history.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-4">
              {closed ? (
                <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <Clock3Icon className="size-4" />
                  This submission form is closed. Your content is now read-only.
                </div>
              ) : fields.length === 0 ? (
                <RichText markdown={selected.submission.description} className="text-sm" />
              ) : (
                <FormRenderer
                  key={selected.submission.id}
                  fields={fields}
                  timezone={data.event.timezone}
                  library={data.library}
                  answers={answers}
                  onAnswersChange={setAnswers}
                  onContinue={async () => {
                    await edit.mutateAsync();
                  }}
                  continueLabel={
                    selected.submission.status === "accepted"
                      ? "Submit changes for approval"
                      : "Save changes"
                  }
                  showContinue={!closed}
                  footerStart={withdrawAction ?? undefined}
                />
              )}
              {selected.submission.status === "accepted" ? (
                <SessionFiles data={data} submissionId={selected.submission.id} />
              ) : null}
              {(closed || fields.length === 0) && withdrawAction !== null ? (
                <div className="mt-5 flex justify-end border-t pt-4">{withdrawAction}</div>
              ) : null}
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No content edits yet.</p>
              ) : (
                <div className="grid gap-2">
                  {history.map((entry) => (
                    <details key={entry.id} className="rounded-md border bg-card">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
                        <HistoryIcon className="size-3.5" />
                        <span className="font-medium">{entry.authorName}</span>
                        <span className="text-muted-foreground">
                          edited {describeChangedFields(entry.changedFields)} ·{" "}
                          <Timestamp value={entry.createdAt} timezone={data.event.timezone} />
                        </span>
                        <span className="ml-auto capitalize text-muted-foreground">
                          {entry.approvalStatus.replace("_", " ")}
                        </span>
                      </summary>
                      <div className="border-t p-3">
                        <div className="grid gap-2">
                          {contentDiffRows(entry).map((row) => (
                            <div key={row.key} className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded bg-muted p-2">
                                <p className="mb-1 font-medium capitalize text-muted-foreground">
                                  Before · {row.label}
                                </p>
                                <pre className="whitespace-pre-wrap font-sans">{row.before}</pre>
                              </div>
                              <div className="rounded bg-muted p-2">
                                <p className="mb-1 font-medium capitalize text-muted-foreground">
                                  After · {row.label}
                                </p>
                                <pre className="whitespace-pre-wrap font-sans">{row.after}</pre>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(entry.id)}
                          >
                            <RotateCcwIcon /> Restore
                          </Button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

type SpeakerData = Extract<
  Awaited<ReturnType<typeof import("@/server-fns/portal").getSpeakerPortal>>,
  { readonly ok: true }
>["data"];

function SessionFiles({
  data,
  submissionId,
}: {
  readonly data: SpeakerData;
  readonly submissionId: string;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <p className="text-xs text-muted-foreground">
          Upload the assets your organizer needs for this session.
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">
        {data.requirements.flatMap((requirement) => {
          const assignment = data.requirementAssignments.find(
            (candidate) =>
              candidate.submissionId === submissionId && candidate.requirementId === requirement.id,
          );
          if (assignment === undefined) return [];
          const file = data.files.find((item) => item.upload.assignmentId === assignment.id);
          return [
            <SessionFileRow
              key={assignment.id}
              data={data}
              submissionId={submissionId}
              requirement={requirement}
              assignment={assignment}
              upload={file?.upload}
            />,
          ];
        })}
      </div>
    </section>
  );
}

function SessionFileRow({
  data,
  submissionId,
  requirement,
  assignment,
  upload,
}: {
  readonly data: SpeakerData;
  readonly submissionId: string;
  readonly requirement: SpeakerData["requirements"][number];
  readonly assignment: SpeakerData["requirementAssignments"][number];
  readonly upload: SpeakerData["files"][number]["upload"] | undefined;
}) {
  const due = requirement.dueAt === null ? null : new Date(requirement.dueAt);
  const overdue = due !== null && due.getTime() < Date.now();
  const versions = data.versions
    .map((item) => item.version)
    .filter((version) => version.fileUploadId === upload?.id);
  const comments = data.comments
    .map((item) => item.comment)
    .filter((comment) => comment.fileUploadId === upload?.id);
  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{requirement.title}</p>
          <p className="truncate text-xs text-muted-foreground">{requirement.description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accepted: {requirement.acceptTypes ?? "any file type"} · Maximum:{" "}
            {requirement.maxSizeMb ?? 8} MB
          </p>
        </div>
        {due === null ? null : (
          <p
            className={`shrink-0 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
          >
            {overdue ? "Overdue" : "Due"}{" "}
            <Timestamp value={due} timezone={data.event.timezone} mode="date" />
          </p>
        )}
        <SessionFileUploadAction
          requirement={requirement}
          submissionId={submissionId}
          uploaded={assignment.status !== "outstanding"}
        />
      </div>
      {upload === undefined ? null : (
        <div className="border-t px-3 py-3">
          <FileThread
            embedded
            timezone={data.event.timezone}
            authorName={`${data.contact.firstName} ${data.contact.lastName}`}
            upload={upload}
            versions={versions}
            comments={comments}
          />
        </div>
      )}
    </div>
  );
}

function answersForSubmission(
  submission: {
    readonly title: string;
    readonly description: string;
    readonly formatId: string | null;
    readonly levelId: string | null;
    readonly answers: FormAnswers;
  },
  fields: ReadonlyArray<FormFieldDefinition & { readonly mapsTo: string | null }>,
  trackIds: ReadonlyArray<string>,
  tagIds: ReadonlyArray<string>,
): FormAnswers {
  const answers: Record<string, import("effect").Schema.Json> = { ...submission.answers };
  for (const field of fields) {
    if (field.mapsTo === "title") answers[field.id] = submission.title;
    if (field.mapsTo === "description") answers[field.id] = submission.description;
    if (field.mapsTo === "format_id") answers[field.id] = submission.formatId ?? "";
    if (field.mapsTo === "level_id") answers[field.id] = submission.levelId ?? "";
    if (field.mapsTo === "tracks")
      answers[field.id] = field.fieldType === "checkbox" ? trackIds : (trackIds[0] ?? "");
    if (field.mapsTo === "tags")
      answers[field.id] = field.fieldType === "checkbox" ? tagIds : (tagIds[0] ?? "");
  }
  return answers;
}
