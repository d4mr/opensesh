import type { FileComment, FileUpload, FileVersion } from "@opensesh/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadVersion } from "@/lib/files";
import { addAdminFileComment, addPortalFileComment } from "@/server-fns/portal";

export function FileThread({
  upload,
  versions,
  comments,
  eventId,
}: {
  readonly upload: FileUpload;
  readonly versions: ReadonlyArray<FileVersion>;
  readonly comments: ReadonlyArray<FileComment>;
  readonly eventId?: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const mutation = useMutation({
    mutationFn: async () =>
      eventId === undefined
        ? addPortalFileComment({ data: { fileUploadId: upload.id, body } })
        : addAdminFileComment({ data: { eventId, fileUploadId: upload.id, body } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setBody("");
      await queryClient.invalidateQueries({
        queryKey: eventId === undefined ? ["speaker-portal"] : ["admin-portal", eventId],
      });
    },
  });
  const orderedVersions = [...versions].sort(
    (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  );

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div>
        <p className="text-xs font-semibold">Versions</p>
        <div className="mt-1 divide-y rounded-md border bg-background">
          {orderedVersions.map((version, index) => (
            <div
              key={version.id}
              className="flex items-center justify-between gap-3 px-2.5 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {version.filename}{" "}
                  {index === 0 ? <span className="text-primary">· Current</span> : null}
                </p>
                <p className="text-muted-foreground">
                  {version.uploaderName} ·{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                    new Date(version.uploadedAt),
                  )}{" "}
                  · {(version.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Download ${version.filename}`}
                onClick={async () => {
                  const result = await downloadVersion(version.id);
                  if (result !== undefined && !result.ok) toast.error(result.error.message);
                }}
              >
                <DownloadIcon />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <MessageSquareIcon className="size-3.5" /> Comments
        </p>
        <div className="mt-1 grid gap-1.5">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-md border bg-background px-2.5 py-2 text-xs">
                <div className="flex justify-between gap-3 text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.authorName}</span>
                  <span>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(comment.createdAt))}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={body}
            placeholder="Add a reply…"
            className="h-8 text-xs"
            onChange={(event) => setBody(event.target.value)}
          />
          <Button
            size="sm"
            disabled={body.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}
