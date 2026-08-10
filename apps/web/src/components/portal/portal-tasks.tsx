import type { FormAnswers } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CheckIcon, CircleIcon, FileUpIcon, MessageCircleMoreIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { FormRenderer } from "@/components/forms/form-renderer";
import { FileThread } from "@/components/portal/file-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fileAsBase64 } from "@/lib/files";
import { speakerPortalQuery } from "@/lib/portal-queries";
import {
  completePortalTask,
  submitPortalFormResponse,
  uploadPortalFile,
} from "@/server-fns/portal";

export function PortalTasks() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  return <TaskContent data={portal.data.data} />;
}

function TaskContent({
  data,
}: {
  readonly data: Extract<
    Awaited<ReturnType<(typeof import("@/server-fns/portal"))["getSpeakerPortal"]>>,
    { readonly ok: true }
  >["data"];
}) {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const setOptimisticDone = (assignmentId: string) => {
    queryClient.setQueryData(speakerPortalQuery.queryKey, (current) =>
      current?.ok
        ? {
            ...current,
            ok: true as const,
            data: {
              ...current.data,
              tasks: current.data.tasks.map((item) =>
                item.assignment.id === assignmentId
                  ? {
                      ...item,
                      assignment: {
                        ...item.assignment,
                        status: "done" as const,
                        completedAt: new Date(),
                      },
                    }
                  : item,
              ),
            },
          }
        : current,
    );
  };
  const celebrate = (assignmentId: string, pointer: boolean) => {
    if (pointer && !reduceMotion) {
      setCelebratingId(assignmentId);
      window.setTimeout(() => setCelebratingId(null), 320);
    }
    setOptimisticDone(assignmentId);
  };
  const manual = useMutation({
    mutationFn: ({ assignmentId }: { readonly assignmentId: string; readonly pointer: boolean }) =>
      completePortalTask({ data: { assignmentId } }),
    onMutate: async ({ assignmentId, pointer }) => {
      await queryClient.cancelQueries({ queryKey: speakerPortalQuery.queryKey });
      const previous = queryClient.getQueryData(speakerPortalQuery.queryKey);
      celebrate(assignmentId, pointer);
      return { previous };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(speakerPortalQuery.queryKey, context?.previous),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
    },
  });
  const formMutation = useMutation({
    mutationFn: ({ assignmentId }: { readonly assignmentId: string }) =>
      submitPortalFormResponse({ data: { assignmentId, answers } }),
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      celebrate(variables.assignmentId, true);
      setOpenId(null);
      setAnswers({});
      toast.success("Response recorded");
      await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
    },
  });
  const fileMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      fileRequestId,
      submissionId,
      file,
    }: {
      readonly assignmentId: string;
      readonly fileRequestId: string;
      readonly submissionId: string | null;
      readonly file: File;
    }) =>
      uploadPortalFile({
        data: {
          assignmentId,
          fileRequestId,
          submissionId,
          kind: "request",
          filename: file.name,
          contentType: file.type,
          size: file.size,
          base64: await fileAsBase64(file),
        },
      }),
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      celebrate(variables.assignmentId, true);
      toast.success("File uploaded as a new version");
      await queryClient.invalidateQueries({ queryKey: speakerPortalQuery.queryKey });
    },
  });
  const todo = data.tasks.filter((item) => item.assignment.status === "todo");
  const done = data.tasks.filter((item) => item.assignment.status !== "todo");
  const contactTasks = todo.filter((item) => item.template.scope === "contact");
  const submissionTasks = todo.filter((item) => item.template.scope === "submission");

  const renderTask = (item: (typeof data.tasks)[number], complete: boolean) => {
    const upload = data.files.find(
      (file) =>
        file.upload.fileRequestId === item.template.fileRequestId &&
        file.upload.submissionId === item.assignment.submissionId,
    );
    const versions = data.versions
      .map((entry) => entry.version)
      .filter((version) => version.fileUploadId === upload?.upload.id);
    const comments = data.comments
      .map((entry) => entry.comment)
      .filter((comment) => comment.fileUploadId === upload?.upload.id);
    const unread =
      upload !== undefined &&
      comments.some(
        (comment) =>
          comment.authorEventMemberId !== null &&
          (upload.upload.speakerLastReadAt === null ||
            new Date(comment.createdAt) > new Date(upload.upload.speakerLastReadAt)),
      );
    const linkedFormFields = item.form?.sections.flatMap((section) => section.fields) ?? [];
    const expanded = openId === item.assignment.id;
    const celebrating = celebratingId === item.assignment.id;
    return (
      <motion.div
        key={item.assignment.id}
        layout={celebrating}
        initial={celebrating ? { opacity: 0, transform: "translateY(-8px)" } : false}
        animate={{ opacity: complete ? 0.72 : 1, transform: "translateY(0)" }}
        transition={celebrating ? { type: "spring", duration: 0.3, bounce: 0.18 } : { duration: 0 }}
      >
        <Card className={complete ? "bg-muted/30" : undefined}>
          <CardContent className="p-0">
            <div className="flex items-start gap-3 px-3 py-3">
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={
                  complete ||
                  item.template.portalFormId !== null ||
                  item.template.fileRequestId !== null ||
                  manual.isPending
                }
                aria-label={`Complete ${item.template.title}`}
                onPointerDown={() => setCelebratingId(item.assignment.id)}
                onClick={(event) =>
                  manual.mutate({ assignmentId: item.assignment.id, pointer: event.detail > 0 })
                }
              >
                <motion.span
                  animate={{ transform: celebrating ? "scale(1.12)" : "scale(1)" }}
                  transition={
                    celebrating ? { type: "spring", duration: 0.3, bounce: 0.18 } : { duration: 0 }
                  }
                >
                  {complete ? (
                    <CheckIcon className="size-4 text-primary" />
                  ) : (
                    <CircleIcon className="size-4" />
                  )}
                </motion.span>
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${complete ? "line-through" : ""}`}>
                    {item.template.title}
                  </p>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {item.template.scope}
                  </Badge>
                  {unread ? (
                    <Badge className="gap-1 text-[10px]">
                      <MessageCircleMoreIcon /> Unread comment
                    </Badge>
                  ) : null}
                </div>
                <div
                  className="mt-1 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: item.template.instructions }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.template.dueDate === null
                    ? "No due date"
                    : `Due ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.template.dueDate))}`}
                  {item.submission === null
                    ? ""
                    : ` · ${item.submission.code} — ${item.submission.title}`}
                </p>
              </div>
              {!complete &&
              (item.form !== null || item.fileRequest !== null || upload !== undefined) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpenId(expanded ? null : item.assignment.id);
                    setAnswers({});
                  }}
                >
                  {expanded
                    ? "Close"
                    : item.form !== null
                      ? "Fill form"
                      : upload === undefined
                        ? "Upload"
                        : "View file"}
                </Button>
              ) : null}
            </div>
            {!expanded ? null : (
              <div className="border-t p-3">
                {item.form !== null ? (
                  <div className="grid gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">{item.form.title}</h3>
                      {item.form.sections.map((section) => (
                        <p key={section.id} className="text-xs text-muted-foreground">
                          {section.instructions}
                        </p>
                      ))}
                    </div>
                    <FormRenderer
                      fields={linkedFormFields}
                      library={data.library}
                      answers={answers}
                      onAnswersChange={setAnswers}
                      onContinue={async () => {
                        await formMutation.mutateAsync({ assignmentId: item.assignment.id });
                      }}
                      continueLabel="Submit response"
                    />
                  </div>
                ) : item.fileRequest !== null ? (
                  <div className="grid gap-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-xs font-medium">
                      <FileUpIcon className="size-4" />
                      {upload === undefined ? "Choose file" : "Upload a new version"}
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file !== undefined)
                            fileMutation.mutate({
                              assignmentId: item.assignment.id,
                              fileRequestId: item.fileRequest!.id,
                              submissionId: item.assignment.submissionId,
                              file,
                            });
                        }}
                      />
                    </label>
                    {upload === undefined ? null : (
                      <FileThread upload={upload.upload} versions={versions} comments={comments} />
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="text-xs text-muted-foreground">
            {done.length} of {data.tasks.length} complete
          </p>
        </div>
      </div>
      <div className="grid gap-5">
        <TaskGroup title="My Tasks" empty="No contact tasks outstanding.">
          {contactTasks.map((item) => renderTask(item, false))}
        </TaskGroup>
        <TaskGroup title="Submission Tasks" empty="No submission tasks outstanding.">
          {submissionTasks.map((item) => renderTask(item, false))}
        </TaskGroup>
        {done.length === 0 ? null : (
          <TaskGroup title="Done" empty="">
            {done.map((item) => renderTask(item, true))}
          </TaskGroup>
        )}
      </div>
    </main>
  );
}

function TaskGroup({
  title,
  empty,
  children,
}: {
  readonly title: string;
  readonly empty: string;
  readonly children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : children !== null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-2">
        {hasChildren ? (
          children
        ) : (
          <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}
