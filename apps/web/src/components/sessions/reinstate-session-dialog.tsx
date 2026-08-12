import {
  renderReinstatementEmail,
  type SessionListItem,
  type SessionReinstateResult,
} from "@opensesh/domain";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Timestamp } from "@/components/app/timestamp";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reinstateSession } from "@/server-fns/sessions";

// The inverse of the cancel dialog, with the same anatomy: personal message,
// logged email, live preview. When the session is scheduled and calendar
// invites had gone out, the email carries a fresh invite that restores the
// event in speakers' calendars — no separate Communications step.
export function ReinstateSessionDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  timezone,
  session,
  onComplete,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly eventId: string;
  readonly eventName: string;
  readonly timezone: string;
  readonly session: SessionListItem | undefined;
  readonly onComplete: (result: SessionReinstateResult) => void;
}) {
  const [message, setMessage] = useState("");
  const [notifySpeakers, setNotifySpeakers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setNotifySpeakers(true);
  }, [open]);

  if (session === undefined) return null;
  const speaker = session.speakers[0];
  const scheduled = session.startsAt !== null;
  const preview = renderReinstatementEmail({
    eventName,
    speakerName: speaker?.name.split(" ")[0] ?? "Speaker",
    submissionTitle: session.title,
    message,
    // The dialog cannot know whether invites went out; preview the scheduled
    // case optimistically — the server only attaches the invite when the
    // original chain exists.
    reinvited: scheduled && notifySpeakers,
  });

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const result = await reinstateSession({
      data: { eventId, submissionId: session.id, message, notifySpeakers },
    });
    submittingRef.current = false;
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    onComplete(result.data);
    onOpenChange(false);
    const tasks =
      result.data.reopenedTasks === 0
        ? ""
        : ` — ${result.data.reopenedTasks} ${result.data.reopenedTasks === 1 ? "task" : "tasks"} reopened`;
    const invite = result.data.calendarReinvited
      ? ". The email carries an updated calendar invite."
      : scheduled
        ? ". Send a fresh calendar invite from Communications."
        : "";
    toast.success(`${session.code} reinstated${tasks}${invite}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reinstate {session.code}</DialogTitle>
          <DialogDescription>
            The session returns to the program{scheduled ? ", takes its slot back," : ""} and the
            tasks waived by the cancellation reopen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reinstate-message">Personal message</Label>
              <Textarea
                id="reinstate-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Optional context for the speakers"
                className="min-h-24 resize-none text-sm"
              />
            </div>
            <Label className="flex items-start gap-2 rounded-md border p-2 text-xs font-normal">
              <Checkbox
                checked={notifySpeakers}
                onCheckedChange={(checked) => setNotifySpeakers(checked === true)}
              />
              Email the speakers
            </Label>
            {scheduled ? (
              <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Scheduled <Timestamp value={session.startsAt ?? new Date()} timezone={timezone} />
                {session.roomName === null ? "" : ` · ${session.roomName}`} — if calendar invites
                went out before the cancellation, the email carries an updated invite that restores
                the session in their calendars.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Email preview</p>
            {notifySpeakers ? (
              <>
                <p className="mt-2 text-sm font-semibold">{preview.subject}</p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{preview.text}</div>
                {session.speakers.length > 1 ? (
                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    Previewing the first recipient. A separate personalized message is sent to every
                    speaker.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No email will be sent — the session quietly returns to the program.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep cancelled
          </Button>
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Reinstating…" : "Reinstate session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
