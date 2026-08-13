import {
  renderDecisionEmail,
  type DecisionResult,
  type ReviewDeskListItem,
  type SubmissionDecision,
} from "@opensesh/domain";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { decideSubmissions, informSubmissions } from "@/server-fns/review-desk";

export interface DecisionDialogSubmission {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ReviewDeskListItem["status"];
  readonly notifiedAt?: Date | null;
  readonly submitter: ReviewDeskListItem["submitter"];
  readonly speakers: ReadonlyArray<{ readonly name: string; readonly role: string }>;
  readonly reviewComments?: ReadonlyArray<string>;
}

export function DecisionDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  confirmationRequested = false,
  submissions,
  initialDecision,
  onOptimistic,
  onFailure,
  onComplete,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly eventId: string;
  readonly eventName: string;
  // Mirrors the event's speaker-confirmation setting so the preview shows
  // the same acceptance email the server sends (confirm CTA vs. plain).
  readonly confirmationRequested?: boolean;
  readonly submissions: ReadonlyArray<DecisionDialogSubmission>;
  readonly initialDecision: SubmissionDecision;
  readonly onOptimistic: (decision: SubmissionDecision) => void;
  readonly onFailure: () => void;
  readonly onComplete: (result: DecisionResult) => void;
}) {
  const [decision, setDecision] = useState<SubmissionDecision>(initialDecision);
  const [feedback, setFeedback] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [confirmRedecide, setConfirmRedecide] = useState(false);
  const [approveContent, setApproveContent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDecision(initialDecision);
    setFeedback(
      submissions
        .flatMap((submission) => submission.reviewComments ?? [])
        .slice(0, 3)
        .join("\n\n"),
    );
    setConfirmRedecide(false);
    setApproveContent(false);
    setSendEmail(false);
  }, [initialDecision, open, submissions]);

  const first = submissions[0];
  const preview = renderDecisionEmail({
    decision,
    eventName,
    speakerName: first?.submitter?.name.split(" ")[0] ?? "Submitter",
    submissionTitle: first?.title ?? "Submission",
    feedback,
    confirmationRequested,
  });
  const replacingDecision = submissions.some(
    (submission) =>
      (submission.status === "accepted" || submission.status === "declined") &&
      submission.status !== (decision === "accept" ? "accepted" : "declined") &&
      submission.notifiedAt !== null &&
      submission.notifiedAt !== undefined,
  );

  const submit = async () => {
    if (submittingRef.current || submissions.length === 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    onOptimistic(decision);
    const result = await decideSubmissions({
      data: {
        eventId,
        submissionIds: submissions.map((submission) => submission.id),
        decision,
        confirmRedecide,
        approveContent: decision === "accept" && approveContent,
      },
    });
    submittingRef.current = false;
    setSubmitting(false);
    if (!result.ok) {
      onFailure();
      toast.error(result.error.message);
      return;
    }
    onComplete(result.data);
    if (sendEmail) {
      const informed = await informSubmissions({
        data: {
          eventId,
          submissionIds: submissions.map((submission) => submission.id),
          feedback,
        },
      });
      if (!informed.ok) {
        toast.error(`Decision saved, but email was not queued: ${informed.error.message}`);
        onOpenChange(false);
        return;
      }
      toast.success(
        `Queued ${informed.data.queued} decision email${informed.data.queued === 1 ? "" : "s"}`,
      );
    }
    onOpenChange(false);
    toast.success(
      `${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"} ${decision === "accept" ? "accepted" : "declined"}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(56rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="m-0 shrink-0 gap-1 border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">
            Decide {submissions.length === 1 ? first?.code : `${submissions.length} submissions`}
          </DialogTitle>
          <DialogDescription className="max-w-3xl">
            This updates the program and creates acceptance tasks when applicable. Sending the
            decision is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:border-r">
            <div className="space-y-1.5">
              <Label className="text-xs">Decision</Label>
              <div className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5">
                <Button
                  type="button"
                  size="xs"
                  variant={decision === "accept" ? "default" : "ghost"}
                  onClick={() => setDecision("accept")}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={decision === "decline" ? "destructive" : "ghost"}
                  onClick={() => setDecision("decline")}
                >
                  Decline
                </Button>
              </div>
            </div>
            <Label className="flex items-start gap-2 rounded-md border p-2 text-xs leading-4 font-normal">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              Also send the decision email now
            </Label>
            {sendEmail ? (
              <div className="space-y-1.5">
                <Label htmlFor="decision-feedback" className="text-xs">
                  Personal message
                </Label>
                <Textarea
                  id="decision-feedback"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Optional feedback or requested changes"
                  className="min-h-24 resize-none px-2.5 py-2 text-[13px] leading-5"
                />
                <p className="text-[11px] leading-4 text-muted-foreground">
                  This message is included in the email to each submission's submitter.
                </p>
              </div>
            ) : null}
            {decision === "accept" ? (
              <div className="space-y-1.5">
                <Label className="flex items-start gap-2 rounded-md border p-2 text-xs leading-4 font-normal">
                  <Checkbox
                    checked={approveContent}
                    onCheckedChange={(checked) => setApproveContent(checked === true)}
                  />
                  Also approve content for publication
                </Label>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Accepted sessions appear on public pages only after their content is approved —
                  here, or later from Content.
                </p>
              </div>
            ) : null}
            {replacingDecision ? (
              <Label className="flex items-start gap-2 rounded-md border p-2 text-xs leading-4 font-normal">
                <Checkbox
                  checked={confirmRedecide}
                  onCheckedChange={(checked) => setConfirmRedecide(checked === true)}
                />
                Replace the existing final decision
              </Label>
            ) : null}
          </div>

          <section className="flex min-h-0 flex-col overflow-y-auto border-t bg-muted/20 sm:border-t-0">
            {sendEmail ? (
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
                {submissions.length > 1 ? (
                  <p className="border-t px-4 py-3 text-[11px] leading-4 text-muted-foreground">
                    Previewing the first submitter. A separate personalized message is sent for
                    every submission.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Turn on “Also send” to preview the decision email.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="m-0 shrink-0 border-t bg-background px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={decision === "decline" ? "destructive" : "default"}
            disabled={submitting || (replacingDecision && !confirmRedecide)}
            onClick={() => void submit()}
          >
            {submitting
              ? sendEmail
                ? "Applying and sending…"
                : "Applying…"
              : `${decision === "accept" ? "Accept" : "Decline"}${sendEmail ? " and send" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
