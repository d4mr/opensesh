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
      <DialogContent className="flex max-h-[min(56rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="m-0 shrink-0 gap-1 border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">Reinstate {session.code}</DialogTitle>
          <DialogDescription className="max-w-3xl">
            The session returns to the program{scheduled ? ", takes its slot back," : ""} and the
            tasks waived by the cancellation reopen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:border-r">
            <Label className="flex items-start gap-2 rounded-md border p-2 text-xs leading-4 font-normal">
              <Checkbox
                checked={notifySpeakers}
                onCheckedChange={(checked) => setNotifySpeakers(checked === true)}
              />
              Email the speakers
            </Label>
            {notifySpeakers ? (
              <div className="space-y-1.5">
                <Label htmlFor="reinstate-message" className="text-xs">
                  Personal message
                </Label>
                <Textarea
                  id="reinstate-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Optional context for the speakers"
                  className="min-h-24 resize-none px-2.5 py-2 text-[13px] leading-5"
                />
              </div>
            ) : null}
            {scheduled ? (
              <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Scheduled <Timestamp value={session.startsAt ?? new Date()} timezone={timezone} />
                {session.roomName === null ? "" : ` · ${session.roomName}`} — if calendar invites
                went out before the cancellation, the email carries an updated invite that restores
                the session in their calendars.
              </p>
            ) : null}
          </div>

          <section className="flex min-h-0 flex-col overflow-y-auto border-t bg-muted/20 sm:border-t-0">
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
                  className="min-h-[480px] w-full flex-1 bg-white"
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
                No email will be sent — the session quietly returns to the program.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="m-0 shrink-0 border-t bg-background px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Keep cancelled
          </Button>
          <Button size="sm" disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Reinstating…" : "Reinstate session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
