import {
  type DecisionResult,
  type ReviewDeskEmail,
  type ReviewDeskReview,
  type SubmissionDecision,
  type SubmissionStatus,
} from "@opensesh/domain";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
  MailIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { SessionContentEditor } from "@/components/admin/session-content-editor";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpeakerRow } from "@/components/app/speaker-row";
import { SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/components/forms/datetime-picker";
import { RichText } from "@/components/forms/rich-text";
import { DecisionDialog } from "@/components/review-desk/decision-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { reviewDeskDetailQuery } from "@/lib/review-desk-queries";
import { adminPortalQuery } from "@/lib/portal-queries";
import { cn } from "@/lib/utils";
import { changeSubmissionStatus, getReviewDeskDetail } from "@/server-fns/review-desk";

type DetailResult = Awaited<ReturnType<typeof getReviewDeskDetail>>;

function ReviewBadge({ review }: { readonly review: ReviewDeskReview }) {
  const className =
    review.decision === "approve"
      ? "bg-status-accepted text-status-accepted-foreground"
      : review.decision === "deny"
        ? "bg-status-declined text-status-declined-foreground"
        : "bg-status-maybe text-status-maybe-foreground";
  return <Badge className={className}>{review.decision}</Badge>;
}

export function SubmissionDetail({
  id,
  variant = "page",
  onClose,
}: {
  readonly id: string;
  readonly variant?: "page" | "spotlight";
  readonly onClose?: () => void;
}) {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const detail = useSuspenseQuery(reviewDeskDetailQuery(eventId, id));
  const portal = useQuery({ ...adminPortalQuery(eventId), enabled: eventId.length > 0 });
  const queryClient = useQueryClient();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<SubmissionDecision>("accept");
  const [emailPreview, setEmailPreview] = useState<ReviewDeskEmail | null>(null);
  const decisionSnapshot = useRef<DetailResult | undefined>(undefined);

  if (context === null) return null;
  if (!detail.data.ok) return <p className="p-6 text-sm">{detail.data.error.message}</p>;
  const data = detail.data.data;
  const submission = data.submission;
  const abstractAnswers = data.answers.filter((answer) => answer.section === "abstract");
  const participantAnswers = data.answers.filter((answer) => answer.section === "participant");
  const contentSubmission =
    portal.data?.ok === true
      ? portal.data.data.submissions.find((item) => item.id === submission.id)
      : undefined;
  const contentHistory =
    portal.data?.ok === true
      ? portal.data.data.history
          .map((item) => item.history)
          .filter((item) => item.submissionId === submission.id)
      : [];

  const setDetail = (status: SubmissionStatus, notifiedAt = submission.notifiedAt) => {
    queryClient.setQueryData<DetailResult>(
      reviewDeskDetailQuery(eventId, id).queryKey,
      (current) =>
        current?.ok
          ? {
              ...current,
              data: {
                ...current.data,
                submission: { ...current.data.submission, status, notifiedAt },
              },
            }
          : current,
    );
  };

  const changeStatus = async (status: "pending" | "maybe" | "withdrawn") => {
    const previous = submission.status;
    setDetail(status);
    const result = await changeSubmissionStatus({
      data: { eventId, submissionId: submission.id, status },
    });
    if (!result.ok) {
      setDetail(previous);
      toast.error(result.error.message);
      return;
    }
    void invalidateAfterMutation(queryClient, eventId);
    toast.success(`Marked ${submission.code} ${status}`);
  };

  const openDecision = (next: SubmissionDecision) => {
    setDecision(next);
    setDecisionOpen(true);
  };

  const completeDecision = (result: DecisionResult) => {
    const updated = result.submissions.find((item) => item.id === submission.id);
    if (updated !== undefined) setDetail(updated.status, updated.notifiedAt);
    void invalidateAfterMutation(queryClient, eventId);
  };

  return (
    <main
      className={cn(
        "text-sm",
        variant === "page"
          ? "flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden"
          : "flex h-full min-h-0 flex-col",
      )}
    >
      {variant === "spotlight" ? (
        <SpotlightPanelHeader
          identity={
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {submission.code}
            </span>
          }
          status={<StatusBadge status={submission.status} />}
          actions={
            <Button size="icon-sm" variant="ghost" className="pressable" asChild>
              <Link
                to="/admin/submissions/$id"
                params={{ id: submission.id }}
                search={{ status: "all" }}
                aria-label="Open full submission page"
              >
                <ExternalLinkIcon />
              </Link>
            </Button>
          }
          onClose={() => onClose?.()}
        />
      ) : null}
      <div
        className={
          variant === "spotlight"
            ? "min-h-0 flex-1 overflow-y-auto p-3 pb-16"
            : "min-h-0 flex-1 overflow-y-auto p-4 lg:p-6"
        }
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {variant === "page" ? (
              <>
                <Button variant="ghost" size="xs" asChild className="mb-2 -ml-2">
                  <Link to="/admin/submissions" search={{ status: "all", spotlight: undefined }}>
                    <ArrowLeftIcon /> Back to submissions
                  </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {submission.code}
                  </span>
                  <StatusBadge status={submission.status} />
                </div>
              </>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {submission.notifiedAt === null ? null : (
                <Badge variant="outline" className="gap-1 rounded-md text-muted-foreground">
                  <CheckCircle2Icon className="text-status-accepted" /> Notified
                </Badge>
              )}
            </div>
            <h1 className={cn("mt-1 font-semibold", variant === "page" ? "text-xl" : "text-base")}>
              {submission.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {submission.source} · {submission.format ?? "No format"}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "items-start gap-4",
            variant === "page" ? "grid xl:grid-cols-[minmax(0,1fr)_22rem]" : "space-y-3",
          )}
        >
          <div className="min-w-0 space-y-4">
            {submission.status !== "accepted" || contentSubmission === undefined ? null : (
              <SessionContentEditor
                eventId={eventId}
                timezone={context.event.timezone}
                submission={contentSubmission}
                history={contentHistory}
              />
            )}
            <DetailSection title="Submission answers">
              <AnswerSection
                title="Abstract"
                answers={abstractAnswers}
                timezone={context.event.timezone}
              />
              {participantAnswers.length === 0 ? null : (
                <>
                  <Separator />
                  <AnswerSection
                    title="Participant answers"
                    answers={participantAnswers}
                    timezone={context.event.timezone}
                  />
                </>
              )}
            </DetailSection>

            <DetailSection title="Speakers" className="divide-y">
              {submission.speakers.map((speaker) => (
                <div key={speaker.id} className="px-3 py-2.5">
                  <SpeakerRow
                    person={{
                      id: speaker.id,
                      name: speaker.name,
                      image: speaker.headshotUrl,
                    }}
                    email={speaker.email}
                    meta={
                      <>
                        <p>{speaker.bioPresent ? "Bio added" : "Bio missing"}</p>
                        {speaker.confirmedAt === null ? null : (
                          <p className="mt-1 inline-flex items-center gap-1 text-status-accepted">
                            <UserRoundCheckIcon className="size-3.5" /> Confirmed
                          </p>
                        )}
                      </>
                    }
                  />
                </div>
              ))}
            </DetailSection>
          </div>

          <div className="min-w-0 space-y-4">
            <DetailSection title="Decision" className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current status</span>
                <StatusBadge status={submission.status} />
              </div>
              {submission.status === "accepted" ? (
                // Accepted is a decided fact — the only exits from here are the
                // session's own lifecycle (cancel / reinstate) over on Sessions.
                <div className="space-y-2 border-t pt-3">
                  {submission.cancelledAt === null ? null : (
                    <p className="text-xs text-muted-foreground">
                      Session cancelled by the {submission.cancelledBy ?? "organizer"}{" "}
                      <Timestamp value={submission.cancelledAt} timezone={context.event.timezone} />
                      .
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This submission is a session — manage it from the Sessions page.
                  </p>
                  <Button size="xs" variant="outline" asChild className="pressable">
                    <Link to="/admin/sessions" search={{ state: "all", spotlight: submission.id }}>
                      View session
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => openDecision("accept")}>
                      Accept
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openDecision("decline")}>
                      Decline
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 border-t pt-3">
                    <Button size="xs" variant="ghost" onClick={() => void changeStatus("pending")}>
                      Pending
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => void changeStatus("maybe")}>
                      Maybe
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => void changeStatus("withdrawn")}
                    >
                      Withdrawn
                    </Button>
                  </div>
                </>
              )}
            </DetailSection>

            <DetailSection
              title={`Reviews · ${data.reviews.length + data.roundReviews.length}`}
              className="divide-y"
            >
              {data.reviews.length + data.roundReviews.length === 0 ? (
                <EmptyRow>No reviews yet.</EmptyRow>
              ) : (
                <>
                  {data.reviews.map((review) => (
                    <div key={review.id} className="space-y-2 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <SpeakerBadge
                          person={{
                            name: review.reviewerName,
                            image: review.reviewerImage,
                            title: null,
                            company: null,
                            bio: null,
                            status: null,
                          }}
                        />
                        <ReviewBadge review={review} />
                        <span className="ml-auto text-xs font-medium tabular-nums">
                          {review.score ?? "—"}/5
                        </span>
                      </div>
                      {review.comment === null ? null : (
                        <p className="text-xs leading-5 text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))}
                  {data.roundReviews.map((review) => (
                    <div key={review.assignment.id} className="space-y-2 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <SpeakerBadge
                          person={{
                            name: review.reviewerName,
                            image: null,
                            title: null,
                            company: null,
                            bio: null,
                            status: null,
                          }}
                        />
                        <Badge variant="outline">Round review</Badge>
                        {review.assignment.completedAt === null ? null : (
                          <Timestamp
                            value={review.assignment.completedAt}
                            timezone={context.event.timezone}
                            className="ml-auto text-xs text-muted-foreground"
                          />
                        )}
                      </div>
                      <dl className="space-y-1">
                        {review.answers.map((answer) => (
                          <div key={answer.criterionId} className="flex gap-2 text-xs">
                            <dt className="text-muted-foreground">{answer.label}</dt>
                            <dd className="ml-auto text-right font-medium">
                              {answer.numericValue ?? answer.optionValue ?? answer.textValue ?? "—"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </>
              )}
            </DetailSection>

            <DetailSection title="Activity" className="p-3">
              {data.activity.map((activity, index) => (
                <div key={activity.id} className="flex gap-2.5">
                  {/* Rail: dot plus the segment down to the next entry, so
                      the line stops cleanly at the last one. */}
                  <div className="flex w-2.5 shrink-0 flex-col items-center">
                    {/* The 4px above each dot is drawn as rail (not margin) so
                        the incoming segment meets the dot instead of stopping
                        short. */}
                    <div
                      className={cn("h-1 w-px shrink-0", index === 0 ? "" : "bg-border")}
                      aria-hidden
                    />
                    <CircleIcon
                      className={cn(
                        "size-2.5 shrink-0",
                        activity.kind === "cancelled"
                          ? "fill-destructive text-destructive"
                          : activity.kind === "decided" || activity.kind === "reinstated"
                            ? "fill-status-accepted text-status-accepted"
                            : "fill-muted-foreground text-muted-foreground",
                      )}
                    />
                    {index === data.activity.length - 1 ? null : (
                      <div className="w-px flex-1 bg-border" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 pb-3">
                    <p className="text-xs font-medium">
                      {activity.label}
                      {activity.detail === null ? null : (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          — {activity.detail}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Timestamp value={activity.at} timezone={context.event.timezone} />
                      {activity.actorName === null ? null : <> · {activity.actorName}</>}
                    </p>
                  </div>
                </div>
              ))}
            </DetailSection>

            <DetailSection title="Email history" className="divide-y">
              {data.emails.length === 0 ? (
                <EmptyRow>No email recorded.</EmptyRow>
              ) : (
                data.emails.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => setEmailPreview(email)}
                  >
                    <MailIcon className="mt-0.5 size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{email.subject}</span>
                      <span className="block text-xs text-muted-foreground">
                        {email.recipient ?? "Unknown recipient"} · {email.status}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </DetailSection>
          </div>
        </div>
      </div>

      <DecisionDialog
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        eventId={eventId}
        eventName={context.event.name}
        confirmationRequested={context.event.speakerConfirmationEnabled}
        submissions={[submission]}
        initialDecision={decision}
        onOptimistic={(next) => {
          decisionSnapshot.current = queryClient.getQueryData(
            reviewDeskDetailQuery(eventId, id).queryKey,
          );
          setDetail(next === "accept" ? "accepted" : "declined");
        }}
        onFailure={() => {
          if (decisionSnapshot.current !== undefined)
            queryClient.setQueryData(
              reviewDeskDetailQuery(eventId, id).queryKey,
              decisionSnapshot.current,
            );
        }}
        onComplete={completeDecision}
      />

      <Dialog open={emailPreview !== null} onOpenChange={(open) => !open && setEmailPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{emailPreview?.subject}</DialogTitle>
            <DialogDescription>
              To {emailPreview?.recipient ?? "unknown recipient"}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-6">
            {emailPreview?.body}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

const displayAnswer = (
  value: string | ReadonlyArray<string>,
  fieldType: import("@opensesh/domain").FormFieldType,
  timezone: string,
) => {
  // Rich-text answers (description, bios) hold markdown; participant fields
  // arrive as one value per speaker.
  if (fieldType === "richtext") {
    const markdown = typeof value === "string" ? value : value.join("\n\n");
    if (markdown !== "Not provided" && markdown.length > 0)
      return <RichText markdown={markdown} className="text-sm" />;
  }
  if (typeof value !== "string") return value.join(", ") || "Not provided";
  return fieldType === "datetime" && value !== "Not provided"
    ? `${formatDateTime(value, timezone)} (${timezone})`
    : value;
};

function AnswerSection({
  title,
  answers,
  timezone,
}: {
  readonly title: string;
  readonly timezone: string;
  readonly answers: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly fieldType: import("@opensesh/domain").FormFieldType;
    readonly value: string | ReadonlyArray<string>;
  }>;
}) {
  return (
    <section className="p-3">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {answers.map((answer) => (
          <div
            key={answer.id}
            className={answer.label === "Description" ? "sm:col-span-2" : undefined}
          >
            <dt className="text-xs font-medium text-muted-foreground">{answer.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-5">
              {displayAnswer(answer.value, answer.fieldType, timezone)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EmptyRow({ children }: { readonly children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

// Dense section shell: h-9 muted header strip instead of CardHeader, whose
// [.border-b]:pb-6 variant inflates any bordered header past what py-* can fix.
function DetailSection({
  title,
  className,
  children,
}: {
  readonly title: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex h-9 items-center gap-2 border-b bg-muted/30 px-3">
        <h3 className="text-xs font-medium">{title}</h3>
      </header>
      <div className={className}>{children}</div>
    </section>
  );
}
