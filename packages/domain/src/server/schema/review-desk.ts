import { Schema } from "effect";

import { FormFieldType, FormSection } from "./forms";
import { NullableDate, NullableNumber, NullableString, Score } from "./common";
import { ReviewDecision, SubmissionKind, SubmissionStatus } from "./submissions";
import { HumanReviewResult } from "./reviews";
import { accepted, declined } from "../mail/templates";

export const ReviewDeskTrack = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
});
export type ReviewDeskTrack = typeof ReviewDeskTrack.Type;

export const ReviewDeskTag = Schema.Struct({ id: Schema.String, name: Schema.String });
export type ReviewDeskTag = typeof ReviewDeskTag.Type;

export const ReviewDeskSpeaker = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
  position: Schema.Number,
  bioPresent: Schema.Boolean,
  headshotUrl: NullableString,
  confirmedAt: NullableDate,
});
export type ReviewDeskSpeaker = typeof ReviewDeskSpeaker.Type;

export const ReviewDeskReview = Schema.Struct({
  id: Schema.String,
  reviewerId: Schema.String,
  reviewerName: Schema.String,
  reviewerImage: NullableString,
  decision: ReviewDecision,
  score: NullableNumber,
  comment: NullableString,
  updatedAt: Schema.Date,
});
export type ReviewDeskReview = typeof ReviewDeskReview.Type;

export const ReviewDeskListItem = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  code: Schema.String,
  kind: SubmissionKind,
  status: SubmissionStatus,
  title: Schema.String,
  description: Schema.String,
  format: NullableString,
  source: Schema.String,
  submittedAt: NullableDate,
  createdAt: Schema.Date,
  notifiedAt: NullableDate,
  tracks: Schema.Array(ReviewDeskTrack),
  tags: Schema.Array(ReviewDeskTag),
  speakers: Schema.Array(ReviewDeskSpeaker),
  rating: NullableNumber,
  reviewCount: Schema.Number,
  reviewComments: Schema.Array(Schema.String),
});
export type ReviewDeskListItem = typeof ReviewDeskListItem.Type;

export const ReviewDeskList = Schema.Struct({
  submissions: Schema.Array(ReviewDeskListItem),
  tracks: Schema.Array(ReviewDeskTrack),
  formats: Schema.Array(Schema.String),
  tags: Schema.Array(ReviewDeskTag),
});
export type ReviewDeskList = typeof ReviewDeskList.Type;

export const ReviewDeskAnswer = Schema.Struct({
  id: Schema.String,
  section: FormSection,
  label: Schema.String,
  fieldType: FormFieldType,
  position: Schema.Number,
  value: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
});
export type ReviewDeskAnswer = typeof ReviewDeskAnswer.Type;

export const ReviewDeskActivity = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  at: Schema.Date,
});
export type ReviewDeskActivity = typeof ReviewDeskActivity.Type;

export const ReviewDeskEmail = Schema.Struct({
  id: Schema.String,
  contactId: NullableString,
  recipient: NullableString,
  type: Schema.String,
  subject: Schema.String,
  body: Schema.String,
  status: Schema.String,
  sentAt: NullableDate,
  createdAt: Schema.Date,
});
export type ReviewDeskEmail = typeof ReviewDeskEmail.Type;

export const ReviewDeskDetail = Schema.Struct({
  submission: ReviewDeskListItem,
  answers: Schema.Array(ReviewDeskAnswer),
  reviews: Schema.Array(ReviewDeskReview),
  roundReviews: Schema.Array(HumanReviewResult),
  activity: Schema.Array(ReviewDeskActivity),
  emails: Schema.Array(ReviewDeskEmail),
});
export type ReviewDeskDetail = typeof ReviewDeskDetail.Type;

export const EvaluationItem = Schema.Struct({
  submission: ReviewDeskListItem,
  myReview: Schema.NullOr(ReviewDeskReview),
  reviews: Schema.Array(ReviewDeskReview),
});
export type EvaluationItem = typeof EvaluationItem.Type;

export const EvaluationQueue = Schema.Struct({
  reviewerId: Schema.String,
  viewerIsAdmin: Schema.Boolean,
  reviewed: Schema.Number,
  total: Schema.Number,
  reviewerCount: Schema.Number,
  items: Schema.Array(EvaluationItem),
});
export type EvaluationQueue = typeof EvaluationQueue.Type;

export const ReviewDeskListRequest = Schema.Struct({
  eventId: Schema.String,
  kind: SubmissionKind,
});

export const ReviewDeskDetailRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
});

export const ReviewUpsertRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  decision: ReviewDecision,
  score: Score,
  comment: NullableString,
});

export const StatusChangeRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  status: SubmissionStatus,
});

export const StatusChangeResult = Schema.Struct({
  id: Schema.String,
  status: SubmissionStatus,
});
export type StatusChangeResult = typeof StatusChangeResult.Type;

export const SubmissionDecision = Schema.Literals(["accept", "decline"]);
export type SubmissionDecision = typeof SubmissionDecision.Type;

export const DecisionRequest = Schema.Struct({
  eventId: Schema.String,
  submissionIds: Schema.Array(Schema.String),
  decision: SubmissionDecision,
  feedback: Schema.String,
  confirmRedecide: Schema.Boolean,
});

export const CsvColumn = Schema.Literals([
  "status",
  "code",
  "title",
  "tracks",
  "format",
  "speakers",
  "rating",
  "reviews",
  "source",
  "submitted",
  "notified",
]);
export type CsvColumn = typeof CsvColumn.Type;

export const CsvExportRequest = Schema.Struct({
  eventId: Schema.String,
  kind: SubmissionKind,
  submissionIds: Schema.Array(Schema.String),
  columns: Schema.Array(CsvColumn),
});

export interface DecisionEmailInput {
  readonly decision: SubmissionDecision;
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly feedback: string;
}

export const renderDecisionEmail = (input: DecisionEmailInput) => {
  const render = input.decision === "accept" ? accepted : declined;
  return render({ ...input, portalUrl: "https://opensesh.io/portal" });
};

export const DecisionResult = Schema.Struct({
  submissions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      status: SubmissionStatus,
      notifiedAt: Schema.Date,
    }),
  ),
  createdTasks: Schema.Number,
  createdEmails: Schema.Number,
});
export type DecisionResult = typeof DecisionResult.Type;
