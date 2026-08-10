import type { FormAnswers, FormFieldDefinition } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock3Icon, HistoryIcon, RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { FormRenderer } from "@/components/forms/form-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { speakerPortalQuery } from "@/lib/portal-queries";
import {
  editPortalSubmission,
  restorePortalHistory,
  withdrawPortalSubmission,
} from "@/server-fns/portal";

export function PortalSubmissions() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  return <SubmissionContent data={portal.data.data} />;
}

function SubmissionContent({
  data,
}: {
  readonly data: Extract<
    Awaited<ReturnType<typeof import("@/server-fns/portal").getSpeakerPortal>>,
    { readonly ok: true }
  >["data"];
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(data.submissions[0]?.submission.id ?? null);
  const selected =
    data.submissions.find((item) => item.submission.id === selectedId) ?? data.submissions[0];
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
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers);
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
      await invalidate();
    },
  });
  if (selected === undefined)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
        No submissions yet.
      </main>
    );
  const closed =
    selected.form !== null &&
    (selected.form.status === "closed" ||
      (selected.form.closeDate !== null && new Date(selected.form.closeDate) <= new Date()));
  const history = data.history
    .map((item) => item.history)
    .filter((item) => item.submissionId === selected.submission.id);

  return (
    <main className="mx-auto grid max-w-5xl gap-3 px-4 py-5 md:grid-cols-[280px_1fr]">
      <div className="grid content-start gap-2">
        <h1 className="mb-1 text-lg font-semibold">Submissions</h1>
        {data.submissions.map(({ submission, format }) => (
          <button
            key={submission.id}
            type="button"
            onClick={() => {
              setSelectedId(submission.id);
              setAnswers(
                answersForSubmission(
                  submission,
                  data.fields
                    .map((item) => item.field)
                    .filter(
                      (field) =>
                        field.formId === submission.sourceFormId && field.section === "abstract",
                    ),
                  data.trackIds
                    .filter((item) => item.submissionId === submission.id)
                    .map((item) => item.id),
                  data.tagIds
                    .filter((item) => item.submissionId === submission.id)
                    .map((item) => item.id),
                ),
              );
            }}
            className={`pressable rounded-md border p-3 text-left ${selected.submission.id === submission.id ? "bg-accent" : "bg-card"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                <span className="font-mono tabular-nums">{submission.code}</span> —{" "}
                {submission.title}
              </p>
              <StatusBadge status={submission.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{format?.name ?? "Format pending"}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">{selected.submission.title}</CardTitle>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                {selected.submission.code}
              </p>
            </div>
            <StatusBadge status={selected.submission.status} className="px-2.5 py-1" />
          </div>
        </CardHeader>
        <CardContent className="py-4">
          {selected.submission.contentReviewStatus === "pending_review" ? (
            <div className="mb-3 rounded-md border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)] px-3 py-2 text-xs text-[var(--status-pending)]">
              Your content changes are pending organizer approval. The last approved version remains
              public.
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
        </CardContent>
      </Card>
    </main>
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
