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
      <DialogContent className="flex max-h-[min(48rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="m-0 shrink-0 gap-1 border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">Cancel {session.code}</DialogTitle>
          <DialogDescription className="max-w-3xl">
            The acceptance stays on record — cancelling removes the session from the program
            {scheduled ? ", the agenda," : ""} and public pages, and waives its open tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:border-r">
            <div className="space-y-1.5">
              <Label className="text-xs">Cancelled by</Label>
              <div className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5">
                <Button
                  type="button"
                  size="xs"
                  variant={cause === "organizer" ? "default" : "ghost"}
                  onClick={() => setCause("organizer")}
                >
                  Organizers
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={cause === "speaker" ? "default" : "ghost"}
                  onClick={() => setCause("speaker")}
                >
                  Speaker
                </Button>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                Pick “Speaker” to record a cancellation they asked for.
              </p>
            </div>
            <Label className="flex items-start gap-2 rounded-md border p-2 text-xs leading-4 font-normal">
              <Checkbox
                checked={notifySpeakers}
                onCheckedChange={(checked) => setNotifySpeakers(checked === true)}
              />
              Email the speakers
            </Label>
            {notifySpeakers ? (
              <div className="space-y-1.5">
                <Label htmlFor="cancel-message" className="text-xs">
                  Personal message
                </Label>
                <Textarea
                  id="cancel-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Optional context for the speakers"
                  className="min-h-24 resize-none px-2.5 py-2 text-[13px] leading-5"
                />
              </div>
            ) : null}
            {scheduled ? (
              <p className="rounded-md border border-[var(--status-pending)]/40 bg-[var(--status-pending)]/5 p-2 text-xs">
                Scheduled <Timestamp value={session.startsAt ?? new Date()} timezone={timezone} />
                {session.roomName === null ? "" : ` · ${session.roomName}`} — the slot is freed and,
                if calendar invites went out, the email carries a calendar cancellation.
              </p>
            ) : null}
          </div>

          <section className="min-h-0 overflow-y-auto border-t bg-muted/20 sm:border-t-0">
            {notifySpeakers ? (
              <>
                <div className="border-b px-4 py-3">
                  <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Email preview
                  </p>
                  <p className="mt-1 text-[13px] font-semibold">{preview.subject}</p>
                </div>
                <iframe
                  title={`Preview of ${preview.subject}`}
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-[420px] w-full bg-white"
                />
                {session.speakers.length > 1 ? (
                  <p className="border-t px-4 py-3 text-[11px] leading-4 text-muted-foreground">
                    Previewing the first recipient. A separate personalized message is sent to every
                    speaker.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                No email will be sent — use this only for sessions accepted by mistake.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="m-0 shrink-0 border-t bg-background px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Keep session
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Cancelling…" : "Cancel session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
