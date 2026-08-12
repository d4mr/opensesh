import {
  renderCancellationEmail,
  type SessionCancelResult,
  type SessionCancelledBy,
  type SessionListItem,
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
import { cancelSession } from "@/server-fns/sessions";

// The one cancellation flow: cancelling a session is a lifecycle event with a
// cause — never a re-decide of the acceptance. It mirrors the decision
// dialog: personal message, logged email, and (when the session was scheduled
// and invited) an ICS cancellation that actually leaves calendars.
export function CancelSessionDialog({
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
  readonly onComplete: (result: SessionCancelResult) => void;
}) {
  const [cause, setCause] = useState<SessionCancelledBy>("organizer");
  const [message, setMessage] = useState("");
  const [notifySpeakers, setNotifySpeakers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setCause("organizer");
    setMessage("");
    setNotifySpeakers(true);
  }, [open]);

  if (session === undefined) return null;
  const speaker = session.speakers[0];
  const preview = renderCancellationEmail({
    eventName,
    speakerName: speaker?.name.split(" ")[0] ?? "Speaker",
    submissionTitle: session.title,
    cause,
    message,
  });
  const scheduled = session.startsAt !== null;

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const result = await cancelSession({
      data: { eventId, submissionId: session.id, cause, message, notifySpeakers },
    });
    submittingRef.current = false;
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    onComplete(result.data);
    onOpenChange(false);
    toast.success(`${session.code} cancelled`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cancel {session.code}</DialogTitle>
          <DialogDescription>
            The acceptance stays on record — cancelling removes the session from the program
            {scheduled ? ", the agenda," : ""} and public pages, and waives its open tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cancelled by</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={cause === "organizer" ? "default" : "ghost"}
                  onClick={() => setCause("organizer")}
                >
                  Organizers
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cause === "speaker" ? "default" : "ghost"}
                  onClick={() => setCause("speaker")}
                >
                  Speaker
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick “Speaker” to record a cancellation they asked for.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-message">Personal message</Label>
              <Textarea
                id="cancel-message"
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
              <p className="rounded-md border border-[var(--status-pending)]/40 bg-[var(--status-pending)]/5 p-2 text-xs">
                Scheduled <Timestamp value={session.startsAt ?? new Date()} timezone={timezone} />
                {session.roomName === null ? "" : ` · ${session.roomName}`} — the slot is freed and,
                if calendar invites went out, the email carries a calendar cancellation.
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
                No email will be sent — use this only for sessions accepted by mistake.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep session
          </Button>
          <Button variant="destructive" disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Cancelling…" : "Cancel session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
