import type { FormAnswers, FormFieldDefinition } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock3Icon, HistoryIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { FormRenderer } from "@/components/forms/form-renderer";
import { FileThread } from "@/components/portal/file-thread";
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
import { contentDiffRows, describeChangedFields } from "@/lib/content-diff";
import { fileAsBase64 } from "@/lib/files";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { cn } from "@/lib/utils";
import {
  editPortalSubmission,
  restorePortalHistory,
  uploadPortalFile,
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
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["speaker-portal"] });
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

  return (
    <main className="mx-auto flex h-[calc(100svh-3rem)] w-full max-w-5xl min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={data.submissions.map((item) => item.submission.id)}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-2 px-4 py-5">
            <h1 className="mb-1 text-lg font-semibold">Submissions</h1>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {data.submissions.map(({ submission, format }) => (
                <button
                  key={submission.id}
                  ref={rowRef(submission.id)}
                  type="button"
                  onClick={() => openSpotlight(submission.id)}
                  className={cn(
                    rowClassName(submission.id),
                    "pressable h-9 w-full rounded-md border px-2.5 text-left",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusBadge status={submission.status} />
                    <p className="min-w-0 truncate text-sm font-medium">
                      <span className="font-mono text-xs tabular-nums">{submission.code}</span>
                      <span className="mx-1.5 text-muted-foreground">—</span>
                      <span>{submission.title}</span>
                    </p>
                    {compact ? null : (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {format?.name ?? "Format pending"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        panel={
          selected === undefined ? null : (
            <div className="flex h-full min-h-0 flex-col">
              <SpotlightPanelHeader
                identity={
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {selected.submission.code}
                  </span>
                }
                status={<StatusBadge status={selected.submission.status} />}
                onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <h2 className="mb-3 text-base font-semibold">{selected.submission.title}</h2>
                {selected.submission.contentReviewStatus === "pending_review" ? (
                  <div className="mb-3 rounded-md border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)] px-3 py-2 text-xs text-[var(--status-pending)]">
                    Your content changes are pending organizer approval. The last approved version
                    remains public.
                  </div>
                ) : null}
                <Tabs defaultValue="details">
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
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: selected.submission.description }}
                      />
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
                      />
                    )}
                    {selected.submission.status === "accepted" ? (
                      <SessionFiles data={data} submissionId={selected.submission.id} />
                    ) : null}
                    <div className="mt-5 flex justify-end border-t pt-4">
                      {selected.submission.status === "withdrawn" ? null : (
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
                                This removes the submission from consideration. Its history remains
                                available.
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
                      )}
                    </div>
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
                                {new Intl.DateTimeFormat("en", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(entry.createdAt))}
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
                                      <pre className="whitespace-pre-wrap font-sans">
                                        {row.before}
                                      </pre>
                                    </div>
                                    <div className="rounded bg-muted p-2">
                                      <p className="mb-1 font-medium capitalize text-muted-foreground">
                                        After · {row.label}
                                      </p>
                                      <pre className="whitespace-pre-wrap font-sans">
                                        {row.after}
                                      </pre>
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
          )
        }
      />
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
        {data.requirements.map((requirement) => {
          const file = data.files.find(
            (item) =>
              item.upload.submissionId === submissionId &&
              item.upload.requirementId === requirement.id,
          );
          return (
            <SessionFileRow
              key={requirement.id}
              data={data}
              submissionId={submissionId}
              requirement={requirement}
              upload={file?.upload}
            />
          );
        })}
      </div>
    </section>
  );
}

function SessionFileRow({
  data,
  submissionId,
  requirement,
  upload,
}: {
  readonly data: SpeakerData;
  readonly submissionId: string;
  readonly requirement: SpeakerData["requirements"][number];
  readonly upload: SpeakerData["files"][number]["upload"] | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) =>
      uploadPortalFile({
        data: {
          assignmentId: null,
          fileRequestId: null,
          requirementId: requirement.id,
          submissionId,
          kind: "slides",
          filename: file.name,
          contentType: file.type,
          size: file.size,
          base64: await fileAsBase64(file),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(upload === undefined ? "File uploaded" : "New version uploaded");
      await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
    },
  });
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
        </div>
        {due === null ? null : (
          <p
            className={`shrink-0 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
          >
            {overdue ? "Overdue" : "Due"}{" "}
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
            }).format(due)}
          </p>
        )}
        <input
          ref={input}
          type="file"
          accept={requirement.acceptTypes ?? undefined}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) mutation.mutate(file);
            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant={upload === undefined ? "default" : "outline"}
          disabled={mutation.isPending}
          onClick={() => input.current?.click()}
        >
          <UploadIcon />
          {mutation.isPending ? "Uploading…" : upload === undefined ? "Upload" : "Replace"}
        </Button>
      </div>
      {upload === undefined ? null : (
        <div className="border-t px-3 py-3">
          <FileThread embedded upload={upload} versions={versions} comments={comments} />
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
