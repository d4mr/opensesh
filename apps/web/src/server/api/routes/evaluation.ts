import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Forbidden } from "@opensesh/domain/server/errors";
import { ReviewDesk, Reviews } from "@opensesh/domain/server/repos";
import { NullableString, Score } from "@opensesh/domain/server/schema/common";
import { ReviewDeskReview } from "@opensesh/domain/server/schema/review-desk";
import {
  ReviewAnswerInput,
  ReviewAssignment,
  ReviewerWorkspace,
} from "@opensesh/domain/server/schema/reviews";
import { ReviewDecision } from "@opensesh/domain/server/schema/submissions";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const SubmitAnswersBody = Schema.Struct({
  answers: Schema.Array(ReviewAnswerInput),
});

const RecuseBody = Schema.Struct({
  reason: Schema.String,
});

const SaveReviewBody = Schema.Struct({
  decision: ReviewDecision,
  score: Score,
  comment: NullableString,
});

// The signed-in reviewer's own surface, mirroring the web reviewer workspace:
// requires a user principal whose event membership is "reviewer". The
// workspace endpoints reject admins the same way the web app does — admins
// evaluate through the Reviews endpoints. Ownership, round windows, recusal
// state, and blind-round redaction are all enforced in the domain layer.
export const evaluationEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/my-reviews",
    operationId: "getMyReviews",
    summary: "Get my review queue",
    description:
      "The signed-in reviewer's workspace: every round they belong to, its criteria, their assigned submissions, and the answers they have saved so far. Blind rounds arrive pre-redacted — titles and descriptions are scrubbed of speaker identities and the participants list is empty. Requires a user session with reviewer membership; admins (and organization API keys, which act as admins) use the Reviews endpoints instead.",
    tag: "Reviewer",
    successSchema: ReviewerWorkspace,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You do not have reviewer access" }));
        }
        const reviews = yield* Reviews;
        return yield* reviews.reviewerWorkspace(access.event.id, access.user.userId);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-assignments/{assignmentId}/answers",
    operationId: "submitReviewAnswers",
    summary: "Submit my answers for an assignment",
    description:
      "Saves the reviewer's answers for one assigned submission and marks the assignment completed. Fails if the assignment belongs to another reviewer, the round is outside its open window, the assignment was recused, or a required criterion is missing an answer.",
    tag: "Reviewer",
    bodySchema: SubmitAnswersBody,
    successSchema: ReviewAssignment,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SubmitAnswersBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot submit this review" }));
        }
        const reviews = yield* Reviews;
        const eventMemberId = yield* reviews.eventMemberId(access.event.id, access.user.userId);
        return yield* reviews.submitAnswers(
          context.params.assignmentId ?? "",
          eventMemberId,
          body.answers,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-assignments/{assignmentId}/recuse",
    operationId: "recuseReview",
    summary: "Recuse myself from an assignment",
    description:
      "Declares a conflict of interest on one assigned submission, with a reason. The assignment is excluded from the reviewer's pending queue and cannot be answered afterwards.",
    tag: "Reviewer",
    bodySchema: RecuseBody,
    successSchema: ReviewAssignment,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof RecuseBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot recuse this review" }));
        }
        const reviews = yield* Reviews;
        const eventMemberId = yield* reviews.eventMemberId(access.event.id, access.user.userId);
        return yield* reviews.recuse(
          context.params.assignmentId ?? "",
          eventMemberId,
          body.reason.trim(),
        );
      }),
  }),
  endpoint({
    method: "PUT",
    path: "/events/{eventId}/submissions/{submissionId}/review",
    operationId: "saveMyReview",
    summary: "Save my score for a submission",
    description:
      "Upserts the caller's quick review (decision, score, comment) on a pending submission. Non-admin reviewers may only score submissions inside their assigned tracks; admins score anything in the event.",
    tag: "Reviewer",
    bodySchema: SaveReviewBody,
    successSchema: ReviewDeskReview,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SaveReviewBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "reviewer");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.upsertReview(
          { userId: access.user.userId, isAdmin: access.admin },
          {
            eventId: access.event.id,
            submissionId: context.params.submissionId ?? "",
            decision: body.decision,
            score: body.score,
            comment: body.comment,
          },
        );
      }),
  }),
];
