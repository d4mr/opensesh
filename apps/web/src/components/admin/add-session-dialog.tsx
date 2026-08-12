import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  SpeakerPickerDialog,
  type SpeakerPickerContact,
} from "@/components/admin/speaker-picker-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { adminPortalQuery } from "@/lib/portal-queries";
import { createManualSession } from "@/server-fns/review-desk";

export function AddSessionDialog({
  eventId,
  onCreated,
}: {
  readonly eventId: string;
  readonly onCreated: (submissionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [formatId, setFormatId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [description, setDescription] = useState("");
  const [speakerIds, setSpeakerIds] = useState<ReadonlySet<string>>(new Set());

  if (!portal.data.ok) return null;
  const data = portal.data.data;
  const speakers: ReadonlyArray<SpeakerPickerContact> = data.contacts;
  const selectedSpeakers = speakers.filter((speaker) => speakerIds.has(speaker.id));
  const reset = () => {
    setTitle("");
    setFormatId("");
    setTrackId("");
    setDescription("");
    setSpeakerIds(new Set());
    setPickerOpen(false);
  };
  const mutation = useMutation({
    mutationFn: () =>
      createManualSession({
        data: {
          eventId,
          title,
          description,
          formatId: formatId.length === 0 ? null : formatId,
          trackId: trackId.length === 0 ? null : trackId,
          speakerIds: Array.from(speakerIds),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      reset();
      await invalidateAfterMutation(queryClient, eventId);
      toast.success(`${result.data.code} added`);
      onCreated(result.data.id);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPickerOpen(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="pressable">
          <PlusIcon /> Add session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add session</DialogTitle>
          <DialogDescription>
            Create an accepted session and assign its speakers and deliverables.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="manual-session-title">Title</Label>
            <Input
              id="manual-session-title"
              value={title}
              required
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Format</Label>
            <Select value={formatId} onValueChange={(value) => setFormatId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                {data.library.formats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Track</Label>
            <Select value={trackId} onValueChange={(value) => setTrackId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a track" />
              </SelectTrigger>
              <SelectContent>
                {data.library.tracks.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>
              Description <span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="What will this session cover?"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Speakers</Label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="pressable flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50"
            >
              {speakerIds.size === 0 ? (
                <span className="text-muted-foreground">No speakers selected</span>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex shrink-0 -space-x-1.5">
                    {selectedSpeakers.slice(0, 5).map((speaker) => (
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
                    {speakerIds.size} of {speakers.length} speakers
                  </span>
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">Edit</span>
            </button>
            <SpeakerPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              contacts={speakers}
              value={speakerIds}
              onChange={setSpeakerIds}
              title="Assign speakers"
              description="Every selected speaker gets access to this session in their portal."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={title.trim().length === 0 || speakerIds.size === 0 || mutation.isPending}
            >
              {mutation.isPending ? "Adding…" : "Add session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
