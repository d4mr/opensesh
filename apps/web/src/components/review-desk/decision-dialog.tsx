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
import { decideSubmissions } from "@/server-fns/review-desk";

export function DecisionDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
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
  readonly submissions: ReadonlyArray<ReviewDeskListItem>;
  readonly initialDecision: SubmissionDecision;
  readonly onOptimistic: (decision: SubmissionDecision) => void;
  readonly onFailure: () => void;
  readonly onComplete: (result: DecisionResult) => void;
}) {
  const [decision, setDecision] = useState<SubmissionDecision>(initialDecision);
  const [feedback, setFeedback] = useState("");
  const [confirmRedecide, setConfirmRedecide] = useState(false);
  const [approveContent, setApproveContent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDecision(initialDecision);
    setFeedback(
      submissions
        .flatMap((submission) => submission.reviewComments)
        .slice(0, 3)
        .join("\n\n"),
    );
    setConfirmRedecide(false);
    setApproveContent(false);
  }, [initialDecision, open, submissions]);

  const first = submissions[0];
  const speaker =
    first?.speakers.find((candidate) => /primary/i.test(candidate.role)) ?? first?.speakers[0];
  const preview = renderDecisionEmail({
    decision,
    eventName,
    speakerName: speaker?.name.split(" ")[0] ?? "Speaker",
    submissionTitle: first?.title ?? "Submission",
    feedback,
  });
  const replacingDecision = submissions.some(
    (submission) =>
      (submission.status === "accepted" || submission.status === "declined") &&
      submission.status !== (decision === "accept" ? "accepted" : "declined"),
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
        feedback,
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
    onOpenChange(false);
    toast.success(
      `${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"} ${decision === "accept" ? "accepted" : "declined"}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Decide {submissions.length === 1 ? first?.code : `${submissions.length} submissions`}
          </DialogTitle>
          <DialogDescription>
            This updates the program, creates acceptance tasks when applicable, and records the
            email below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Decision</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={decision === "accept" ? "default" : "ghost"}
                  onClick={() => setDecision("accept")}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={decision === "decline" ? "destructive" : "ghost"}
                  onClick={() => setDecision("decline")}
                >
                  Decline
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision-feedback">Personal message</Label>
              <Textarea
                id="decision-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Optional feedback or requested changes"
                className="min-h-32 resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Review comments are prefilled when available. Edit freely before sending.
              </p>
            </div>
            {decision === "accept" ? (
              <div className="space-y-1.5">
                <Label className="flex items-start gap-2 rounded-md border p-2 text-xs font-normal">
                  <Checkbox
                    checked={approveContent}
                    onCheckedChange={(checked) => setApproveContent(checked === true)}
                  />
                  Also approve content for publication
                </Label>
                <p className="text-xs text-muted-foreground">
                  Accepted sessions appear on public pages only after their content is approved —
                  here, or later from Content.
                </p>
              </div>
            ) : null}
            {replacingDecision ? (
              <Label className="flex items-start gap-2 rounded-md border p-2 text-xs font-normal">
                <Checkbox
                  checked={confirmRedecide}
                  onCheckedChange={(checked) => setConfirmRedecide(checked === true)}
                />
                Replace the existing final decision
              </Label>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Email preview</p>
            <p className="mt-2 text-sm font-semibold">{preview.subject}</p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-6">{preview.text}</div>
            {submissions.length > 1 || (first?.speakers.length ?? 0) > 1 ? (
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                Previewing the first recipient. A separate personalized message is sent to every
                recipient.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={decision === "decline" ? "destructive" : "default"}
            disabled={submitting || (replacingDecision && !confirmRedecide)}
            onClick={() => void submit()}
          >
            {submitting ? "Applying…" : `${decision === "accept" ? "Accept" : "Decline"} and send`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
