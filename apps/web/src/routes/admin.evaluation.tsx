import type { EvaluationQueue, ReviewDecision, ReviewDeskReview } from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { PersonTag } from "@/components/app/person-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminEventsQuery, evaluationQueueQuery } from "@/lib/review-desk-queries";
import { getEvaluationQueue, saveReview } from "@/server-fns/review-desk";

type QueueResult = Awaited<ReturnType<typeof getEvaluationQueue>>;

export const Route = createFileRoute("/admin/evaluation")({
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(evaluationQueueQuery(eventId));
    }
  },
  component: EvaluationRoute,
});

const reviewClass = (decision: ReviewDecision) =>
  decision === "approve"
    ? "bg-status-accepted text-status-accepted-foreground"
    : decision === "deny"
      ? "bg-status-declined text-status-declined-foreground"
      : "bg-status-maybe text-status-maybe-foreground";

function EvaluationRoute() {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const queue = useSuspenseQuery(evaluationQueueQuery(eventId));
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [decision, setDecision] = useState<ReviewDecision>("approve");
  const [score, setScore] = useState(3);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const data = queue.data.ok ? queue.data.data : null;
  const current = data?.items[index];

  useEffect(() => {
    if (current === undefined) return;
    setDecision(current.myReview?.decision ?? "approve");
    setScore(current.myReview?.score ?? 3);
    setComment(current.myReview?.comment ?? "");
  }, [current]);

  const setQueue = useCallback(
    (update: (current: EvaluationQueue) => EvaluationQueue) => {
      queryClient.setQueryData<QueueResult>(evaluationQueueQuery(eventId).queryKey, (existing) =>
        existing?.ok ? { ...existing, data: update(existing.data) } : existing,
      );
    },
    [eventId, queryClient],
  );

  const submit = useCallback(
    async (advance: boolean) => {
      if (data === null || current === undefined || saving) return;
      setSaving(true);
      const previous = queryClient.getQueryData<QueueResult>(
        evaluationQueueQuery(eventId).queryKey,
      );
      const optimistic: ReviewDeskReview = {
        id: current.myReview?.id ?? `optimistic-${data.reviewerId}-${current.submission.id}`,
        reviewerId: data.reviewerId,
        reviewerName: current.myReview?.reviewerName ?? "You",
        reviewerImage: current.myReview?.reviewerImage ?? null,
        decision,
        score,
        comment: comment.trim().length === 0 ? null : comment.trim(),
        updatedAt: new Date(),
      };
      setQueue((existing) => ({
        ...existing,
        reviewed: existing.items.some(
          (item) =>
            item.submission.id === current.submission.id &&
            (existing.viewerIsAdmin ? item.reviews.length > 0 : item.myReview !== null),
        )
          ? existing.reviewed
          : existing.reviewed + 1,
        items: existing.items.map((item) =>
          item.submission.id === current.submission.id
            ? {
                ...item,
                myReview: optimistic,
                reviews: [
                  ...item.reviews.filter((review) => review.reviewerId !== data.reviewerId),
                  optimistic,
                ],
              }
            : item,
        ),
      }));
      if (advance) setIndex((value) => Math.min(value + 1, data.items.length - 1));
      const result = await saveReview({
        data: {
          eventId,
          submissionId: current.submission.id,
          decision,
          score,
          comment: comment.trim().length === 0 ? null : comment.trim(),
        },
      });
      setSaving(false);
      if (!result.ok) {
        if (previous !== undefined)
          queryClient.setQueryData(evaluationQueueQuery(eventId).queryKey, previous);
        if (advance) setIndex((value) => Math.max(0, value - 1));
        toast.error(result.error.message);
        return;
      }
      setQueue((existing) => ({
        ...existing,
        items: existing.items.map((item) =>
          item.submission.id === current.submission.id
            ? {
                ...item,
                myReview: result.data,
                reviews: [
                  ...item.reviews.filter((review) => review.reviewerId !== data.reviewerId),
                  result.data,
                ],
              }
            : item,
        ),
      }));
      toast.success(`Saved review for ${current.submission.code}`);
      void queryClient.invalidateQueries({ queryKey: ["review-desk", eventId] });
      void queryClient.invalidateQueries({
        queryKey: ["review-desk-detail", eventId, current.submission.id],
      });
    },
    [comment, current, data, decision, eventId, queryClient, saving, score, setQueue],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        event.preventDefault();
        setDecision(event.key === "1" ? "approve" : event.key === "2" ? "maybe" : "deny");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((value) => Math.min((data?.items.length ?? 1) - 1, value + 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        void submit(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data?.items.length, submit]);

  if (context === null) return null;
  if (!queue.data.ok) return <p className="p-6 text-sm">{queue.data.error.message}</p>;
  if (data === null || current === undefined) return null;

  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Evaluation</h1>
          <p className="text-sm text-muted-foreground">
            Pending submissions routed by reviewer track.
          </p>
        </div>
        <p className="text-sm font-medium tabular-nums" aria-live="polite">
          {data.reviewed} of {data.total} reviewed{" "}
          {data.viewerIsAdmin ? "in this plan" : "in your tracks"}
        </p>
      </div>

      {data.viewerIsAdmin ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <div>
            <p className="text-xs font-semibold">Main evaluation plan</p>
            <p className="text-xs text-muted-foreground">
              {data.reviewerCount} active {data.reviewerCount === 1 ? "reviewer" : "reviewers"} ·
              all pending tracks
            </p>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {data.reviewed}/{data.total}
          </Badge>
        </div>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card
          className="gap-0 py-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          <CardHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {current.submission.code}
              </span>
              {current.myReview === null ? (
                <Badge variant="outline">Not reviewed</Badge>
              ) : (
                <Badge className={reviewClass(current.myReview.decision)}>Reviewed</Badge>
              )}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {index + 1} / {data.items.length}
              </span>
            </div>
            <CardTitle className="mt-2 text-base">{current.submission.title}</CardTitle>
            <div className="flex flex-wrap gap-1">
              {current.submission.tracks.map((track) => (
                <Badge key={track.id} variant="outline" className="rounded-md">
                  {track.name}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <p className="leading-6 text-muted-foreground">{current.submission.description}</p>
            <div className="flex flex-wrap gap-1">
              {current.submission.speakers.map((speaker) => (
                <Badge key={speaker.id} variant="secondary" className="rounded-md">
                  {speaker.name}
                </Badge>
              ))}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Decision</Label>
                <span className="text-xs text-muted-foreground">1 Approve · 2 Maybe · 3 Deny</span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                {(["approve", "maybe", "deny"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={
                      decision === value ? (value === "deny" ? "destructive" : "default") : "ghost"
                    }
                    className="capitalize transition-none active:transform-none"
                    onClick={() => setDecision(value)}
                  >
                    {decision === value ? <CheckIcon /> : null}
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Score</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="icon-sm"
                    variant={score === value ? "default" : "outline"}
                    className="transition-none active:transform-none"
                    onClick={() => setScore(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="What should the organizer know?"
                className="min-h-24 resize-none"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Previous submission"
                  disabled={index === 0}
                  className="transition-none active:transform-none"
                  onClick={() => setIndex((value) => value - 1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Next submission"
                  disabled={index === data.items.length - 1}
                  className="transition-none active:transform-none"
                  onClick={() => setIndex((value) => value + 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  className="transition-none active:transform-none"
                  onClick={() => void submit(false)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  className="transition-none active:transform-none"
                  onClick={() => void submit(true)}
                >
                  {saving ? "Saving…" : "Save & next"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="text-sm">All reviews · {current.reviews.length}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {current.reviews.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">No reviews yet.</p>
            ) : (
              current.reviews.map((review) => (
                <div key={review.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PersonTag
                      person={{ name: review.reviewerName, image: review.reviewerImage }}
                    />
                    <Badge className={reviewClass(review.decision)}>{review.decision}</Badge>
                    <span className="ml-auto text-xs tabular-nums">{review.score ?? "—"}/5</span>
                  </div>
                  {review.comment === null ? null : (
                    <p className="text-xs leading-5 text-muted-foreground">{review.comment}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
