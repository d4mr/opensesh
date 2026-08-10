import {
  type DecisionResult,
  type ReviewDeskEmail,
  type ReviewDeskReview,
  type SubmissionDecision,
  type SubmissionStatus,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  MailIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { PersonTag } from "@/components/app/person-tag";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDateTime } from "@/components/forms/datetime-picker";
import { DecisionDialog } from "@/components/review-desk/decision-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  adminEventsQuery,
  reviewDeskDetailQuery,
  reviewDeskListQuery,
} from "@/lib/review-desk-queries";
import { changeSubmissionStatus, getReviewDeskDetail } from "@/server-fns/review-desk";

type DetailResult = Awaited<ReturnType<typeof getReviewDeskDetail>>;

export const Route = createFileRoute("/admin/abstracts_/$id")({
  loader: async ({ context, params }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(reviewDeskDetailQuery(eventId, params.id));
    }
  },
  component: SubmissionDetailRoute,
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");

function ReviewBadge({ review }: { readonly review: ReviewDeskReview }) {
  const className =
    review.decision === "approve"
      ? "bg-status-accepted text-status-accepted-foreground"
      : review.decision === "deny"
        ? "bg-status-declined text-status-declined-foreground"
        : "bg-status-maybe text-status-maybe-foreground";
  return <Badge className={className}>{review.decision}</Badge>;
}

function SubmissionDetailRoute() {
  const { id } = Route.useParams();
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const detail = useSuspenseQuery(reviewDeskDetailQuery(eventId, id));
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
    void queryClient.invalidateQueries({
      queryKey: reviewDeskListQuery(eventId, submission.kind).queryKey,
    });
    toast.success(`Marked ${submission.code} ${status}`);
  };

  const openDecision = (next: SubmissionDecision) => {
    setDecision(next);
    setDecisionOpen(true);
  };

  const completeDecision = (result: DecisionResult) => {
    const updated = result.submissions.find((item) => item.id === submission.id);
    if (updated !== undefined) setDetail(updated.status, updated.notifiedAt);
    // Acceptance graduates abstracts to kind='session', so both desks change.
    void queryClient.invalidateQueries({
      queryKey: reviewDeskListQuery(eventId, "abstract").queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: reviewDeskListQuery(eventId, "session").queryKey,
    });
    void queryClient.invalidateQueries({ queryKey: reviewDeskDetailQuery(eventId, id).queryKey });
  };

  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="xs" asChild className="mb-2 -ml-2">
            <Link to="/admin/abstracts" search={{ status: "all" }}>
              <ArrowLeftIcon /> Back to abstracts
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {submission.code}
            </span>
            <StatusBadge status={submission.status} />
            {submission.notifiedAt === null ? null : (
              <Badge variant="outline" className="gap-1 rounded-md text-muted-foreground">
                <CheckCircle2Icon className="text-status-accepted" /> Notified
              </Badge>
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold">{submission.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {submission.source} · {submission.format ?? "No format"}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Submission answers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Speakers</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {submission.speakers.map((speaker) => (
                <div key={speaker.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar size="lg">
                    {speaker.headshotUrl === null ? null : (
                      <AvatarImage src={speaker.headshotUrl} alt="" />
                    )}
                    <AvatarFallback>{initials(speaker.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{speaker.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{speaker.email}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{speaker.bioPresent ? "Bio added" : "Bio missing"}</p>
                    {speaker.confirmedAt === null ? null : (
                      <p className="mt-1 inline-flex items-center gap-1 text-status-accepted">
                        <UserRoundCheckIcon className="size-3.5" /> Confirmed
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current status</span>
                <StatusBadge status={submission.status} />
              </div>
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
                <Button size="xs" variant="ghost" onClick={() => void changeStatus("withdrawn")}>
                  Withdrawn
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Reviews · {data.reviews.length}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {data.reviews.length === 0 ? (
                <EmptyRow>No reviews yet.</EmptyRow>
              ) : (
                data.reviews.map((review) => (
                  <div key={review.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PersonTag
                        person={{ name: review.reviewerName, image: review.reviewerImage }}
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
                ))
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {data.activity.map((activity) => (
                <div key={activity.id} className="flex gap-2">
                  <CircleIcon className="mt-1 size-2.5 fill-muted-foreground text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">{activity.label}</p>
                    <p className="text-xs text-muted-foreground">{dateTime.format(activity.at)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="text-sm">Email history</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {data.emails.length === 0 ? (
                <EmptyRow>No email recorded.</EmptyRow>
              ) : (
                data.emails.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/50"
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
            </CardContent>
          </Card>
        </div>
      </div>

      <DecisionDialog
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        eventId={eventId}
        eventName={context.event.name}
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
    <section className="p-4">
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
