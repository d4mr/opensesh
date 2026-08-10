import { Schema, Struct } from "effect";

import {
  EntityFields,
  JsonObject,
  NullableDate,
  NullableNumber,
  NullableString,
  RichText5000,
  Score,
  Text255,
} from "./common";

export const SubmissionKind = Schema.Literals(["abstract", "session"]);
export const SubmissionStatus = Schema.Literals([
  "draft",
  "pending",
  "maybe",
  "accepted",
  "declined",
  "withdrawn",
]);
export type SubmissionStatus = typeof SubmissionStatus.Type;
export const ContentApprovalStatus = Schema.Literals(["approved", "pending_review", "rejected"]);
export type ContentApprovalStatus = typeof ContentApprovalStatus.Type;
export const DietaryRequirement = Schema.Literals([
  "none",
  "vegetarian",
  "vegan",
  "gluten_free",
  "other",
]);
export type DietaryRequirement = typeof DietaryRequirement.Type;
export const TshirtSize = Schema.Literals(["XS", "S", "M", "L", "XL", "XXL"]);
export type TshirtSize = typeof TshirtSize.Type;
export const ReviewDecision = Schema.Literals(["approve", "maybe", "deny"]);
export type ReviewDecision = typeof ReviewDecision.Type;

const contactFields = {
  eventId: Schema.String,
  email: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  title: NullableString,
  company: NullableString,
  salutation: NullableString,
  honorific: NullableString,
  pronouns: NullableString,
  gender: NullableString,
  bio: Schema.NullOr(RichText5000),
  headshotUrl: NullableString,
  headshotKey: NullableString,
  dietaryRequirements: DietaryRequirement,
  tshirtSize: Schema.NullOr(TshirtSize),
  phone: NullableString,
  linkedinUrl: NullableString,
  twitterUrl: NullableString,
  facebookUrl: NullableString,
  websiteUrl: NullableString,
  confirmedAt: NullableDate,
  custom: JsonObject,
};

export const Contact = Schema.Struct({ ...EntityFields, ...contactFields });
export type Contact = typeof Contact.Type;
export const ContactCreate = Schema.Struct(contactFields);
export type ContactCreate = typeof ContactCreate.Type;
export const ContactUpdate = Schema.Struct(Struct.map(contactFields, Schema.optionalKey));
export type ContactUpdate = typeof ContactUpdate.Type;

const submissionFields = {
  eventId: Schema.String,
  code: Schema.String,
  kind: SubmissionKind,
  status: SubmissionStatus,
  sourceFormId: NullableString,
  submitterContactId: NullableString,
  title: Text255,
  description: RichText5000,
  formatId: NullableString,
  levelId: NullableString,
  language: Schema.String,
  startsAt: NullableDate,
  endsAt: NullableDate,
  roomId: NullableString,
  scheduleDirty: Schema.Boolean,
  capacity: NullableNumber,
  ceuCredits: NullableNumber,
  clientSessionId: NullableString,
  notifiedAt: NullableDate,
  submittedAt: NullableDate,
  answers: JsonObject,
  approvedSnapshot: JsonObject,
  contentReviewStatus: ContentApprovalStatus,
};

export const Submission = Schema.Struct({ ...EntityFields, ...submissionFields });
export type Submission = typeof Submission.Type;

export const DashboardSubmissionRow = Schema.Struct({
  submissionId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  kind: SubmissionKind,
  status: SubmissionStatus,
  createdAt: Schema.Date,
  startsAt: NullableDate,
  endsAt: NullableDate,
  roomId: NullableString,
  reviewId: NullableString,
  trackName: NullableString,
  reviewerName: NullableString,
  reviewerImage: NullableString,
});
export type DashboardSubmissionRow = typeof DashboardSubmissionRow.Type;

export const DashboardSubmission = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  kind: SubmissionKind,
  status: SubmissionStatus,
  track: NullableString,
  reviewer: Schema.NullOr(
    Schema.Struct({
      name: Schema.String,
      image: NullableString,
    }),
  ),
});
export type DashboardSubmission = typeof DashboardSubmission.Type;

export const SubmissionCreate = Schema.Struct(Struct.omit(submissionFields, ["code"]));
export type SubmissionCreate = typeof SubmissionCreate.Type;
export const SubmissionUpdate = Schema.Struct(
  Struct.map(Struct.omit(submissionFields, ["eventId", "code"]), Schema.optionalKey),
);
export type SubmissionUpdate = typeof SubmissionUpdate.Type;

export const SubmissionEditHistory = Schema.Struct({
  ...EntityFields,
  submissionId: Schema.String,
  authorContactId: NullableString,
  authorEventMemberId: NullableString,
  authorName: Schema.String,
  changedFields: Schema.Array(Schema.String),
  previousValues: JsonObject,
  newValues: JsonObject,
  approvalStatus: ContentApprovalStatus,
  reviewedAt: NullableDate,
  reviewedByEventMemberId: NullableString,
});
export type SubmissionEditHistory = typeof SubmissionEditHistory.Type;

export const SubmissionTrack = Schema.Struct({
  ...EntityFields,
  submissionId: Schema.String,
  trackId: Schema.String,
});
export type SubmissionTrack = typeof SubmissionTrack.Type;

export const SubmissionTag = Schema.Struct({
  ...EntityFields,
  submissionId: Schema.String,
  tagId: Schema.String,
});
export type SubmissionTag = typeof SubmissionTag.Type;

export const SubmissionParticipant = Schema.Struct({
  ...EntityFields,
  submissionId: Schema.String,
  contactId: Schema.String,
  role: Schema.String,
  position: Schema.Number,
});
export type SubmissionParticipant = typeof SubmissionParticipant.Type;

export const SubmissionParticipantCreate = Schema.Struct({
  contactId: Schema.String,
  role: Schema.String,
  position: Schema.Number,
});
export type SubmissionParticipantCreate = typeof SubmissionParticipantCreate.Type;

const reviewFields = {
  submissionId: Schema.String,
  reviewerId: Schema.String,
  decision: ReviewDecision,
  score: Schema.NullOr(Score),
  comment: NullableString,
};

export const Review = Schema.Struct({ ...EntityFields, ...reviewFields });
export type Review = typeof Review.Type;
export const ReviewUpsert = Schema.Struct(reviewFields);
export type ReviewUpsert = typeof ReviewUpsert.Type;
