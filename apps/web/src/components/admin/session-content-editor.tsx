import type { Submission, SubmissionEditHistory } from "@opensesh/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HistoryIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ChangeDiff } from "@/components/app/change-diff";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contentDiffRows, describeChangedFields } from "@/lib/content-diff";
import { restoreAdminHistory, updateAdminSessionContent } from "@/server-fns/portal";

type SessionContent = Pick<
  Submission,
  "id" | "code" | "title" | "description" | "contentReviewStatus"
>;

const timestamp = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function SessionContentEditor({
  eventId,
  submission,
  history,
}: {
  readonly eventId: string;
  readonly submission: SessionContent;
  readonly history: ReadonlyArray<SubmissionEditHistory>;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (editing) return;
    setTitle(submission.title);
    setDescription(submission.description);
  }, [editing, submission.description, submission.title]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] }),
      queryClient.invalidateQueries({ queryKey: ["review-desk-detail", eventId, submission.id] }),
      queryClient.invalidateQueries({ queryKey: ["review-desk", eventId, "session"] }),
      queryClient.invalidateQueries({ queryKey: ["public-program"] }),
      queryClient.invalidateQueries({ queryKey: ["public-session"] }),
      queryClient.invalidateQueries({ queryKey: ["public-widget"] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () =>
      updateAdminSessionContent({
        data: { eventId, submissionId: submission.id, title, description },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEditing(false);
      setError(undefined);
      toast.success(`${submission.code} content saved and approved`);
      await refresh();
    },
  });
  const restore = useMutation({
    mutationFn: (historyId: string) => restoreAdminHistory({ data: { eventId, historyId } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`${submission.code} restored as a new approved version`);
      await refresh();
    },
  });
  const orderedHistory = [...history].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Session content</h3>
            <p className="text-[11px] text-muted-foreground">
              {submission.contentReviewStatus === "approved" ? "Approved" : "Pending review"}
            </p>
          </div>
          {editing ? null : (
            <Button
              size="sm"
              variant="outline"
              className="pressable"
              onClick={() => setEditing(true)}
            >
              <PencilIcon /> Edit session
            </Button>
          )}
        </div>
        {editing ? (
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`session-title-${submission.id}`}>Title</Label>
              <Input
                id={`session-title-${submission.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Abstract</Label>
              <RichTextEditor value={description} onChange={setDescription} />
            </div>
            {error === undefined ? null : (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTitle(submission.title);
                  setDescription(submission.description);
                  setError(undefined);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  if (title.trim().length === 0) {
                    setError("Add a session title");
                    return;
                  }
                  setError(undefined);
                  save.mutate();
                }}
              >
                {save.isPending ? "Saving…" : "Save and approve"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="border-b px-3 py-2.5">
              <p className="text-sm font-medium">{submission.title}</p>
            </div>
            <div
              className="rte-content px-3 py-2.5 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: submission.description }}
            />
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">Content history</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {orderedHistory.length} version{orderedHistory.length === 1 ? "" : "s"}
          </span>
        </div>
        {orderedHistory.length === 0 ? (
          <p className="text-xs italic text-muted-foreground/70">No content changes yet.</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {orderedHistory.map((entry) => (
              <details key={entry.id} className="group bg-background">
                <summary className="pressable flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs">
                  <HistoryIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {entry.authorName} · {describeChangedFields(entry.changedFields)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {timestamp.format(new Date(entry.createdAt))}
                    </span>
                  </span>
                  <span className="capitalize text-muted-foreground">
                    {entry.approvalStatus.replace("_", " ")}
                  </span>
                </summary>
                <div className="grid gap-3 border-t p-3">
                  <ChangeDiff rows={contentDiffRows(entry)} />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="pressable w-fit">
                        <RotateCcwIcon /> Restore this version
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Restore this session version?</DialogTitle>
                        <DialogDescription>
                          The selected snapshot becomes current. Existing history stays intact and a
                          new attributed version is added.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(entry.id)}
                          >
                            Restore
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
