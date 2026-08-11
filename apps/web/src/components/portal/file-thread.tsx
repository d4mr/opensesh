import type { FileComment, FileUpload, FileVersion } from "@opensesh/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PersonHoverCard } from "@/components/app/person-popover";
import { Timestamp } from "@/components/app/timestamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadVersion } from "@/lib/files";
import {
  addAdminFileComment,
  addPortalFileComment,
  getPortalAdmin,
  getSpeakerPortal,
} from "@/server-fns/portal";

type AdminPortalResult = Awaited<ReturnType<typeof getPortalAdmin>>;
type SpeakerPortalResult = Awaited<ReturnType<typeof getSpeakerPortal>>;
type ThreadComment = FileComment & { readonly pending?: boolean };

const authorRole = (value: {
  readonly authorContactId: string | null;
  readonly authorEventMemberId: string | null;
}) => (value.authorEventMemberId === null ? "Speaker" : "Organizer");

const uploaderRole = (value: {
  readonly uploaderContactId: string | null;
  readonly uploaderEventMemberId: string | null;
}) => (value.uploaderEventMemberId === null ? "Speaker" : "Organizer");

// Admin-side person names carry the rich hover card; contact-backed names
// lazy-load the full profile, organizer names show a static identity card.
function ThreadPersonName({
  name,
  contactId,
  role,
  admin,
}: {
  readonly name: string;
  readonly contactId: string | null;
  readonly role: string;
  readonly admin: boolean;
}) {
  const label = <span className="font-medium text-foreground">{name}</span>;
  if (!admin) return label;
  return (
    <PersonHoverCard
      person={
        contactId === null
          ? { name, image: null, title: role }
          : { id: contactId, name, image: null }
      }
    >
      {label}
    </PersonHoverCard>
  );
}

export function FileThread({
  upload,
  versions,
  comments,
  authorName,
  timezone,
  eventId,
  embedded = false,
}: {
  readonly upload: FileUpload;
  readonly versions: ReadonlyArray<FileVersion>;
  readonly comments: ReadonlyArray<ThreadComment>;
  readonly authorName: string;
  readonly timezone: string;
  readonly eventId?: string;
  readonly embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const queryKey =
    eventId === undefined ? (["speaker-portal"] as const) : (["admin-portal", eventId] as const);
  const mutation = useMutation({
    mutationFn: async (commentBody: string) =>
      eventId === undefined
        ? addPortalFileComment({ data: { fileUploadId: upload.id, body: commentBody } })
        : addAdminFileComment({ data: { eventId, fileUploadId: upload.id, body: commentBody } }),
    onMutate: async (commentBody) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      const optimisticId = `optimistic:${crypto.randomUUID()}`;
      const now = new Date();
      const optimistic: ThreadComment = {
        id: optimisticId,
        fileUploadId: upload.id,
        authorContactId: eventId === undefined ? upload.contactId : null,
        authorEventMemberId: eventId === undefined ? null : "optimistic-organizer",
        authorName,
        body: commentBody,
        createdAt: now,
        updatedAt: now,
        pending: true,
      };
      setBody("");

      if (eventId === undefined) {
        const previous = queryClient.getQueryData<SpeakerPortalResult>(queryKey);
        queryClient.setQueryData<SpeakerPortalResult>(queryKey, (current) =>
          current?.ok
            ? {
                ...current,
                data: {
                  ...current.data,
                  comments: [...current.data.comments, { comment: optimistic }],
                },
              }
            : current,
        );
        return { commentBody, optimisticId, previousSpeaker: previous };
      }

      const previous = queryClient.getQueryData<AdminPortalResult>(queryKey);
      queryClient.setQueryData<AdminPortalResult>(queryKey, (current) =>
        current?.ok
          ? {
              ...current,
              data: {
                ...current.data,
                comments: [...current.data.comments, { comment: optimistic }],
              },
            }
          : current,
      );
      return { commentBody, optimisticId, previousAdmin: previous };
    },
    onError: (_error, _commentBody, context) => {
      setBody(context?.commentBody ?? "");
      if (eventId === undefined) {
        if (context?.previousSpeaker !== undefined)
          queryClient.setQueryData(queryKey, context.previousSpeaker);
      } else if (context?.previousAdmin !== undefined) {
        queryClient.setQueryData(queryKey, context.previousAdmin);
      }
      toast.error("Could not send the reply");
    },
    onSuccess: (result, _commentBody, context) => {
      if (!result.ok) {
        setBody(context.commentBody);
        if (eventId === undefined) {
          if (context.previousSpeaker !== undefined)
            queryClient.setQueryData(queryKey, context.previousSpeaker);
        } else if (context.previousAdmin !== undefined) {
          queryClient.setQueryData(queryKey, context.previousAdmin);
        }
        toast.error(result.error.message);
        return;
      }

      if (eventId === undefined) {
        queryClient.setQueryData<SpeakerPortalResult>(queryKey, (current) =>
          current?.ok
            ? {
                ...current,
                data: {
                  ...current.data,
                  comments: current.data.comments.map((item) =>
                    item.comment.id === context.optimisticId ? { comment: result.data } : item,
                  ),
                },
              }
            : current,
        );
      } else {
        queryClient.setQueryData<AdminPortalResult>(queryKey, (current) =>
          current?.ok
            ? {
                ...current,
                data: {
                  ...current.data,
                  comments: current.data.comments.map((item) =>
                    item.comment.id === context.optimisticId ? { comment: result.data } : item,
                  ),
                },
              }
            : current,
        );
      }
      void queryClient.invalidateQueries({ queryKey, exact: true });
    },
  });
  const orderedVersions = [...versions].sort(
    (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  );

  return (
    <div className={embedded ? "grid gap-3" : "grid gap-3 rounded-md border bg-muted/20 p-3"}>
      {/* min-w-0: long filenames must not inflate the implicit grid track */}
      <div className="min-w-0">
        <p className="text-xs font-semibold">Versions</p>
        <div
          className={
            embedded
              ? "mt-1 divide-y border-y bg-background"
              : "mt-1 divide-y rounded-md border bg-background"
          }
        >
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
                  <ThreadPersonName
                    name={version.uploaderName}
                    contactId={version.uploaderContactId}
                    role={uploaderRole(version)}
                    admin={eventId !== undefined}
                  />{" "}
                  · {uploaderRole(version)} ·{" "}
                  <Timestamp value={version.uploadedAt} timezone={timezone} mode="date" /> ·{" "}
                  {(version.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className="pressable"
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
                  <span>
                    <ThreadPersonName
                      name={comment.authorName}
                      contactId={comment.authorContactId}
                      role={authorRole(comment)}
                      admin={eventId !== undefined}
                    />{" "}
                    · {authorRole(comment)}
                  </span>
                  {comment.pending === true ? (
                    <span>Sending…</span>
                  ) : (
                    <Timestamp value={comment.createdAt} timezone={timezone} />
                  )}
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && body.trim().length > 0 && !mutation.isPending)
                mutation.mutate(body.trim());
            }}
          />
          <Button
            size="sm"
            className="pressable"
            disabled={body.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate(body.trim())}
          >
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}
