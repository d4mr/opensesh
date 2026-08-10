import { Schema } from "effect";

import { FormFieldType, FormSection } from "./forms";
import { NullableDate, NullableNumber, NullableString, Score } from "./common";
import { ReviewDecision, SubmissionKind, SubmissionStatus } from "./submissions";

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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const renderDecisionEmail = (input: DecisionEmailInput) => {
  const accepted = input.decision === "accept";
  const subject = accepted
    ? `You're speaking at ${input.eventName}`
    : `An update on your ${input.eventName} submission`;
  const introduction = accepted
    ? `We are delighted to accept “${input.submissionTitle}.” Your onboarding tasks are ready in the speaker portal.`
    : `Thank you for the thoughtful proposal “${input.submissionTitle}.” We are not able to include it in this year's program.`;
  const feedback = input.feedback.trim();
  const text = [
    `Hi ${input.speakerName},`,
    introduction,
    feedback.length === 0 ? "" : `Feedback from the review team:\n${feedback}`,
    "The OpenSesh program team",
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
  const feedbackHtml =
    feedback.length === 0
      ? ""
      : `<div style="margin-top:20px;padding:14px;border:1px solid #e3e5dc;border-radius:8px"><strong>Feedback from the review team</strong><p style="white-space:pre-wrap">${escapeHtml(feedback)}</p></div>`;
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#1b211d"><p>Hi ${escapeHtml(input.speakerName)},</p><p>${escapeHtml(introduction)}</p>${feedbackHtml}<p style="margin-top:24px">The OpenSesh program team</p></div>`;
  return { subject, text, html };
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
