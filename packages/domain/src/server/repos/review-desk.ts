import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contacts,
  emailLog,
  eventMembers,
  events,
  formFields,
  formats,
  forms,
  levels,
  reviewAnswers,
  reviewAssignments,
  reviewCriteria,
  reviewerTracks,
  reviews,
  sessionFileRequirementAssignments,
  sessionFileRequirements,
  submissionActivity,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  taskAssignments,
  taskTemplates,
  tracks,
  users,
} from "../../db/schema";
import { Db, type Database } from "../db";
import { AlreadyDecided, type DbError, Forbidden, InvalidInput, NotFound } from "../errors";
import {
  JsonObject,
  NullableDate,
  NullableNumber,
  NullableString,
  type AuditActor,
} from "../schema/common";
import { FormFieldType, FormSection } from "../schema/forms";
import {
  DecisionResult,
  InformResult,
  type EvaluationItem,
  EvaluationQueue,
  type ReviewDeskAnswer,
  ReviewDeskDetail,
  ReviewDeskDetailItem,
  type ReviewDeskEmail,
  ReviewDeskList,
  ReviewDeskListItem,
  ReviewDeskReview,
  type ReviewDeskSpeaker,
  type ReviewDeskTag,
  type ReviewDeskTrack,
  StatusChangeResult,
  renderDecisionEmail,
  type SubmissionDecision,
} from "../schema/review-desk";
import {
  HumanReviewResult,
  ReviewAnswer,
  ReviewAssignment,
  ReviewCriterion,
} from "../schema/reviews";
import { ReviewDecision, SessionCancelledBy, SubmissionStatus } from "../schema/submissions";
import { activityActorColumns, decode, decodeFound, decodeMany, query } from "./shared";
import { loadTimeline } from "./timeline";

const submitterContact = alias(contacts, "review_desk_submitter");

const RawListRow = Schema.Struct({
  submissionId: Schema.String,
  eventId: Schema.String,
  code: Schema.String,
  status: SubmissionStatus,
  cancelledAt: NullableDate,
  cancelledBy: Schema.NullOr(SessionCancelledBy),
  title: Schema.String,
  description: Schema.String,
  answers: JsonObject,
  formatName: NullableString,
  levelName: NullableString,
  sourceName: NullableString,
  submittedAt: NullableDate,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  notifiedAt: NullableDate,
  submitterId: NullableString,
  submitterFirstName: NullableString,
  submitterLastName: NullableString,
  submitterEmail: NullableString,
  trackId: NullableString,
  trackName: NullableString,
  trackColor: NullableString,
  tagId: NullableString,
  tagName: NullableString,
  contactId: NullableString,
  contactFirstName: NullableString,
  contactLastName: NullableString,
  contactEmail: NullableString,
  contactBio: NullableString,
  contactHeadshotUrl: NullableString,
  contactConfirmedAt: NullableDate,
  contactCustom: Schema.NullOr(JsonObject),
  participantRole: NullableString,
  participantPosition: NullableNumber,
  reviewId: NullableString,
  reviewerId: NullableString,
  reviewerName: NullableString,
  reviewerImage: NullableString,
  reviewDecision: Schema.NullOr(ReviewDecision),
  reviewScore: NullableNumber,
  reviewComment: NullableString,
  reviewUpdatedAt: NullableDate,
});
type RawListRow = typeof RawListRow.Type;

const RawDetailRow = Schema.Struct({
  ...RawListRow.fields,
  fieldId: NullableString,
  fieldSection: Schema.NullOr(FormSection),
  fieldLabel: NullableString,
  fieldType: Schema.NullOr(FormFieldType),
  fieldPosition: NullableNumber,
  fieldMapsTo: NullableString,
  emailId: NullableString,
  emailContactId: NullableString,
  emailRecipient: NullableString,
  emailType: NullableString,
  emailSubject: NullableString,
  emailBody: NullableString,
  emailStatus: NullableString,
  emailSentAt: NullableDate,
  emailCreatedAt: NullableDate,
});
type RawDetailRow = typeof RawDetailRow.Type;

const CompletedRoundReviewRow = Schema.Struct({
  assignmentId: Schema.String,
  submissionId: Schema.String,
});

const RawRoundReviewRow = Schema.Struct({
  assignment: ReviewAssignment,
  reviewerName: Schema.String,
  reviewerEmail: Schema.String,
  answer: Schema.NullOr(ReviewAnswer),
  criterion: Schema.NullOr(ReviewCriterion),
});

interface MutableListItem {
  readonly base: Omit<
    ReviewDeskDetailItem,
    "tracks" | "tags" | "speakers" | "rating" | "reviewCount" | "reviewComments"
  >;
  readonly tracks: Map<string, ReviewDeskTrack>;
  readonly tags: Map<string, ReviewDeskTag>;
  readonly speakers: Map<string, ReviewDeskSpeaker>;
  readonly reviews: Map<string, ReviewDeskReview>;
}

const makeListItems = (rows: ReadonlyArray<RawListRow>) => {
  const grouped = new Map<string, MutableListItem>();
  for (const row of rows) {
    let item = grouped.get(row.submissionId);
    if (item === undefined) {
      item = {
        base: {
          id: row.submissionId,
          eventId: row.eventId,
          code: row.code,
          status: row.status,
          cancelledAt: row.cancelledAt,
          cancelledBy: row.cancelledBy,
          title: row.title,
          description: row.description,
          format: row.formatName,
          source: row.sourceName ?? "Manual",
          submittedAt: row.submittedAt,
          createdAt: row.createdAt,
          notifiedAt: row.notifiedAt,
          submitter:
            row.submitterId === null ||
            row.submitterFirstName === null ||
            row.submitterLastName === null ||
            row.submitterEmail === null
              ? null
              : {
                  id: row.submitterId,
                  name: `${row.submitterFirstName} ${row.submitterLastName}`.trim(),
                  email: row.submitterEmail,
                },
        },
        tracks: new Map(),
        tags: new Map(),
        speakers: new Map(),
        reviews: new Map(),
      };
      grouped.set(row.submissionId, item);
    }
    if (row.trackId !== null && row.trackName !== null && row.trackColor !== null) {
      item.tracks.set(row.trackId, {
        id: row.trackId,
        name: row.trackName,
        color: row.trackColor,
      });
    }
    if (row.tagId !== null && row.tagName !== null) {
      item.tags.set(row.tagId, { id: row.tagId, name: row.tagName });
    }
    if (
      row.contactId !== null &&
      row.contactFirstName !== null &&
      row.contactLastName !== null &&
      row.contactEmail !== null
    ) {
      item.speakers.set(row.contactId, {
        id: row.contactId,
        name: `${row.contactFirstName} ${row.contactLastName}`.trim(),
        email: row.contactEmail,
        role: row.participantRole ?? "Speaker",
        position: row.participantPosition ?? 0,
        bioPresent: row.contactBio !== null && row.contactBio.trim().length > 0,
        headshotUrl: row.contactHeadshotUrl,
        confirmedAt: row.contactConfirmedAt,
      });
    }
    if (
      row.reviewId !== null &&
      row.reviewerId !== null &&
      row.reviewerName !== null &&
      row.reviewDecision !== null &&
      row.reviewUpdatedAt !== null
    ) {
      item.reviews.set(row.reviewId, {
        id: row.reviewId,
        reviewerId: row.reviewerId,
        reviewerName: row.reviewerName,
        reviewerImage: row.reviewerImage,
        decision: row.reviewDecision,
        score: row.reviewScore,
        comment: row.reviewComment,
        updatedAt: row.reviewUpdatedAt,
      });
    }
  }
  return Array.from(grouped.values()).map((item) => {
    const reviewRows = Array.from(item.reviews.values());
    const scores = reviewRows.flatMap((review) => (review.score === null ? [] : [review.score]));
    return {
      ...item.base,
      tracks: Array.from(item.tracks.values()),
      tags: Array.from(item.tags.values()),
      speakers: Array.from(item.speakers.values()),
      rating:
        scores.length === 0
          ? null
          : scores.reduce((total, score) => total + score, 0) / scores.length,
      reviewCount: reviewRows.length,
      reviewComments: reviewRows.flatMap((review) =>
        review.comment === null || review.comment.trim().length === 0 ? [] : [review.comment],
      ),
    };
  });
};

const rawListSelection = {
  submissionId: submissions.id,
  eventId: submissions.eventId,
  code: submissions.code,
  status: submissions.status,
  cancelledAt: submissions.cancelledAt,
  cancelledBy: submissions.cancelledBy,
  title: submissions.title,
  description: submissions.description,
  answers: submissions.answers,
  formatName: formats.name,
  levelName: levels.name,
  sourceName: forms.internalName,
  submittedAt: submissions.submittedAt,
  createdAt: submissions.createdAt,
  updatedAt: submissions.updatedAt,
  notifiedAt: submissions.notifiedAt,
  submitterId: submitterContact.id,
  submitterFirstName: submitterContact.firstName,
  submitterLastName: submitterContact.lastName,
  submitterEmail: submitterContact.email,
  trackId: tracks.id,
  trackName: tracks.name,
  trackColor: tracks.color,
  tagId: tags.id,
  tagName: tags.name,
  contactId: contacts.id,
  contactFirstName: contacts.firstName,
  contactLastName: contacts.lastName,
  contactEmail: contacts.email,
  contactBio: contacts.bio,
  contactHeadshotUrl: contacts.headshotUrl,
  contactConfirmedAt: contacts.confirmedAt,
  contactCustom: contacts.custom,
  participantRole: submissionParticipants.role,
  participantPosition: submissionParticipants.position,
  reviewId: reviews.id,
  reviewerId: reviews.reviewerId,
  reviewerName: users.name,
  reviewerImage: users.image,
  reviewDecision: reviews.decision,
  reviewScore: reviews.score,
  reviewComment: reviews.comment,
  reviewUpdatedAt: reviews.updatedAt,
};

// Access was decided at the boundary (requireEventAccess); the query only
// tenant-scopes by the trusted eventId. The desk is the CFP lens: every
// form-origin row across its whole lifecycle, acceptance included. Manual
// sessions (source_form_id null) have no submission to track and never
// appear here — they live on the Sessions surface only.
const listQuery = (database: Database, eventId: string) =>
  query(database, "Could not load submissions", (db) =>
    db
      .select(rawListSelection)
      .from(submissions)
      .leftJoin(formats, eq(formats.id, submissions.formatId))
      .leftJoin(levels, eq(levels.id, submissions.levelId))
      .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
      .leftJoin(submitterContact, eq(submitterContact.id, submissions.submitterContactId))
      .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
      .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
      .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
      .leftJoin(tags, eq(tags.id, submissionTags.tagId))
      .leftJoin(submissionParticipants, eq(submissionParticipants.submissionId, submissions.id))
      .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .leftJoin(users, eq(users.id, reviews.reviewerId))
      .where(and(eq(submissions.eventId, eventId), isNotNull(submissions.sourceFormId)))
      .orderBy(
        desc(submissions.submittedAt),
        desc(submissions.createdAt),
        asc(submissionParticipants.position),
      )
      .execute(),
  );

const completedRoundReviewRows = (
  database: Database,
  eventId: string,
  submissionIds: ReadonlyArray<string>,
) =>
  submissionIds.length === 0
    ? Effect.succeed([])
    : query(database, "Could not count completed round reviews", (db) =>
        db
          .select({
            assignmentId: reviewAssignments.id,
            submissionId: reviewAssignments.submissionId,
          })
          .from(reviewAssignments)
          .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
          .where(
            and(
              eq(submissions.eventId, eventId),
              eq(reviewAssignments.status, "completed"),
              inArray(reviewAssignments.submissionId, submissionIds),
            ),
          )
          .execute(),
      ).pipe(
        Effect.flatMap((rows) =>
          decodeMany(CompletedRoundReviewRow, "completed round review", rows),
        ),
      );

const roundReviewRows = (database: Database, eventId: string, submissionId: string) =>
  query(database, "Could not load completed round reviews", (db) =>
    db
      .select({
        assignment: reviewAssignments,
        reviewerName: users.name,
        reviewerEmail: users.email,
        answer: reviewAnswers,
        criterion: reviewCriteria,
      })
      .from(reviewAssignments)
      .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
      .innerJoin(eventMembers, eq(eventMembers.id, reviewAssignments.eventMemberId))
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .leftJoin(reviewAnswers, eq(reviewAnswers.assignmentId, reviewAssignments.id))
      .leftJoin(reviewCriteria, eq(reviewCriteria.id, reviewAnswers.criterionId))
      .where(
        and(
          eq(submissions.eventId, eventId),
          eq(reviewAssignments.submissionId, submissionId),
          eq(reviewAssignments.status, "completed"),
        ),
      )
      .orderBy(desc(reviewAssignments.completedAt), asc(reviewCriteria.position))
      .execute(),
  ).pipe(Effect.flatMap((rows) => decodeMany(RawRoundReviewRow, "round review row", rows)));

type ReviewDeskFailure = DbError | Forbidden | InvalidInput | NotFound | AlreadyDecided;

export const decisionConfirmationRequired = (
  current: typeof SubmissionStatus.Type,
  notifiedAt: Date | null,
  next: "accepted" | "declined",
) => (current === "accepted" || current === "declined") && current !== next && notifiedAt !== null;

export const decisionFactUpdate = (status: "accepted" | "declined", now: Date) => ({
  status,
  updatedAt: now,
});

export const informValidationError = (
  rows: ReadonlyArray<{
    readonly status: typeof SubmissionStatus.Type;
    readonly notifiedAt: Date | null;
    readonly submitterContactId: string | null;
    readonly email: string | null;
    readonly firstName: string | null;
  }>,
) => {
  if (rows.some((row) => row.status !== "accepted" && row.status !== "declined"))
    return "Only accepted or declined submissions can be informed";
  if (rows.some((row) => row.notifiedAt !== null))
    return "One or more decisions were already informed";
  if (
    rows.some(
      (row) => row.submitterContactId === null || row.email === null || row.firstName === null,
    )
  )
    return "Every informed submission needs a submitter";
  return null;
};

export const informFactUpdate = (now: Date) => ({ notifiedAt: now, updatedAt: now });

export const decisionEmailLogValue = (input: {
  readonly eventId: string;
  readonly submissionId: string;
  readonly submitterContactId: string;
  readonly decision: "accepted" | "declined";
  readonly recipient: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}) => ({
  eventId: input.eventId,
  contactId: input.submitterContactId,
  submissionId: input.submissionId,
  type: input.decision,
  recipient: input.recipient,
  subject: input.subject,
  body: input.text,
  htmlBody: input.html,
  icsAttached: false,
  icsContent: null,
  icsSequence: null,
  status: "queued" as const,
  provider: null,
  providerId: null,
  error: null,
  sentAt: null,
});

interface DecisionSuccess {
  readonly kind: "success";
  readonly result: typeof DecisionResult.Type;
}

type DecisionTransaction =
  | DecisionSuccess
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "alreadyDecided"; readonly message: string };

type InformTransaction =
  | {
      readonly kind: "success";
      readonly result: typeof InformResult.Type;
      readonly logIds: ReadonlyArray<string>;
    }
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid"; readonly message: string };

type ReviewTransaction =
  | { readonly kind: "notFound" }
  | { readonly kind: "forbidden" }
  | {
      readonly kind: "success";
      readonly review: typeof reviews.$inferSelect | null;
      readonly reviewerName: string;
      readonly reviewerImage: string | null;
    };

interface ReviewDeskViewer {
  readonly userId: string;
  readonly isAdmin: boolean;
}

interface ReviewDeskService {
  readonly list: (eventId: string) => Effect.Effect<ReviewDeskList, DbError>;
  readonly detail: (
    eventId: string,
    submissionId: string,
  ) => Effect.Effect<typeof ReviewDeskDetail.Type, DbError | NotFound>;
  readonly evaluationQueue: (
    viewer: ReviewDeskViewer,
    eventId: string,
  ) => Effect.Effect<typeof EvaluationQueue.Type, DbError | Forbidden>;
  readonly upsertReview: (
    viewer: ReviewDeskViewer,
    input: {
      readonly eventId: string;
      readonly submissionId: string;
      readonly decision: typeof ReviewDecision.Type;
      readonly score: number;
      readonly comment: string | null;
    },
  ) => Effect.Effect<ReviewDeskReview, DbError | Forbidden | NotFound>;
  readonly changeStatus: (
    eventId: string,
    submissionId: string,
    status: typeof SubmissionStatus.Type,
    actor: AuditActor,
  ) => Effect.Effect<typeof StatusChangeResult.Type, DbError | Forbidden | InvalidInput | NotFound>;
  readonly decide: (input: {
    readonly eventId: string;
    readonly submissionIds: ReadonlyArray<string>;
    readonly decision: SubmissionDecision;
    readonly confirmRedecide: boolean;
    readonly approveContent: boolean;
    readonly actor: AuditActor;
  }) => Effect.Effect<DecisionSuccess, ReviewDeskFailure>;
  readonly inform: (input: {
    readonly eventId: string;
    readonly submissionIds: ReadonlyArray<string>;
    readonly feedback: string;
    readonly actor: AuditActor;
  }) => Effect.Effect<
    { readonly result: typeof InformResult.Type; readonly logIds: ReadonlyArray<string> },
    DbError | InvalidInput | NotFound
  >;
  readonly markEmail: (logId: string, status: "sent" | "failed") => Effect.Effect<void, DbError>;
}

export class ReviewDesk extends Context.Service<ReviewDesk, ReviewDeskService>()(
  "opensesh/ReviewDesk",
) {}

export const ReviewDeskLive = Layer.effect(
  ReviewDesk,
  Effect.gen(function* () {
    const { database } = yield* Db;
    const emailRecipient = alias(contacts, "review_desk_email_recipient");

    return {
      // An empty result is just an empty desk; access was decided at the
      // boundary.
      list: (eventId) =>
        listQuery(database, eventId).pipe(
          Effect.flatMap((rows) => decodeMany(RawListRow, "review desk row", rows)),
          Effect.flatMap((rows) =>
            Effect.gen(function* () {
              const items = makeListItems(rows);
              const roundRows = yield* completedRoundReviewRows(
                database,
                eventId,
                items.map((item) => item.id),
              );
              const mailRows = yield* query(database, "Could not count decision mail", (db) =>
                db
                  .select({ status: emailLog.status })
                  .from(emailLog)
                  .where(eq(emailLog.eventId, eventId))
                  .execute(),
              );
              const roundCounts = new Map<string, number>();
              for (const row of roundRows) {
                roundCounts.set(row.submissionId, (roundCounts.get(row.submissionId) ?? 0) + 1);
              }
              const submissions = yield* decodeMany(
                ReviewDeskListItem,
                "review desk submission",
                items.map((item) => ({
                  ...item,
                  reviewCount: item.reviewCount + (roundCounts.get(item.id) ?? 0),
                })),
              );
              return {
                submissions,
                mailStatus: {
                  queued: mailRows.filter((row) => row.status === "queued").length,
                  sending: mailRows.filter((row) => row.status === "sending").length,
                },
              };
            }),
          ),
          Effect.flatMap(({ submissions: items, mailStatus }) => {
            const trackMap = new Map<string, ReviewDeskTrack>();
            const tagMap = new Map<string, ReviewDeskTag>();
            const formatSet = new Set<string>();
            for (const item of items) {
              for (const track of item.tracks) trackMap.set(track.id, track);
              for (const tag of item.tags) tagMap.set(tag.id, tag);
              if (item.format !== null) formatSet.add(item.format);
            }
            return decode(ReviewDeskList, "review desk list", {
              submissions: items,
              tracks: Array.from(trackMap.values()),
              formats: Array.from(formatSet).sort(),
              tags: Array.from(tagMap.values()),
              mailStatus,
            });
          }),
        ),
      detail: (eventId, submissionId) => {
        return query(database, "Could not load submission detail", (db) =>
          db
            .select({
              ...rawListSelection,
              fieldId: formFields.id,
              fieldSection: formFields.section,
              fieldLabel: formFields.label,
              fieldType: formFields.fieldType,
              fieldPosition: formFields.position,
              fieldMapsTo: formFields.mapsTo,
              emailId: emailLog.id,
              emailContactId: emailLog.contactId,
              emailRecipient: emailRecipient.email,
              emailType: emailLog.type,
              emailSubject: emailLog.subject,
              emailBody: emailLog.body,
              emailStatus: emailLog.status,
              emailSentAt: emailLog.sentAt,
              emailCreatedAt: emailLog.createdAt,
            })
            .from(submissions)
            .leftJoin(formats, eq(formats.id, submissions.formatId))
            .leftJoin(levels, eq(levels.id, submissions.levelId))
            .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
            .leftJoin(submitterContact, eq(submitterContact.id, submissions.submitterContactId))
            .leftJoin(formFields, eq(formFields.formId, submissions.sourceFormId))
            .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
            .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
            .leftJoin(tags, eq(tags.id, submissionTags.tagId))
            .leftJoin(
              submissionParticipants,
              eq(submissionParticipants.submissionId, submissions.id),
            )
            .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
            .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
            .leftJoin(users, eq(users.id, reviews.reviewerId))
            .leftJoin(emailLog, eq(emailLog.submissionId, submissions.id))
            .leftJoin(emailRecipient, eq(emailRecipient.id, emailLog.contactId))
            .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, eventId)))
            .orderBy(
              asc(formFields.position),
              asc(submissionParticipants.position),
              asc(reviews.createdAt),
              desc(emailLog.createdAt),
            )
            .execute(),
        ).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new NotFound({ message: "Submission not found" }),
          ),
          Effect.flatMap((rows) => decodeMany(RawDetailRow, "submission detail row", rows)),
          Effect.flatMap((rows) =>
            Effect.gen(function* () {
              const item = makeListItems(rows)[0];
              if (item === undefined) {
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              }
              const submission = rows[0];
              if (submission === undefined) {
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              }
              const speakers = new Map<string, RawDetailRow>();
              const reviewMap = new Map<string, ReviewDeskReview>();
              const emailMap = new Map<string, ReviewDeskEmail>();
              const rawRoundReviews = yield* roundReviewRows(database, eventId, submissionId);
              const roundReviews = yield* decodeMany(
                HumanReviewResult,
                "round review",
                Array.from(
                  new Map(
                    rawRoundReviews.map((row) => [row.assignment.id, row.assignment]),
                  ).values(),
                ).map((assignment) => {
                  const identity = rawRoundReviews.find(
                    (row) => row.assignment.id === assignment.id,
                  );
                  return {
                    assignment,
                    reviewerName: identity?.reviewerName ?? "Reviewer",
                    reviewerEmail: identity?.reviewerEmail ?? "",
                    answers: rawRoundReviews.flatMap((row) =>
                      row.assignment.id !== assignment.id ||
                      row.answer === null ||
                      row.criterion === null
                        ? []
                        : [
                            {
                              criterionId: row.criterion.id,
                              label: row.criterion.label,
                              type: row.criterion.type,
                              numericValue: row.answer.numericValue,
                              textValue: row.answer.textValue,
                              optionValue: row.answer.optionValue,
                            },
                          ],
                    ),
                  };
                }),
              );
              for (const row of rows) {
                if (row.contactId !== null) speakers.set(row.contactId, row);
                if (
                  row.reviewId !== null &&
                  row.reviewerId !== null &&
                  row.reviewerName !== null &&
                  row.reviewDecision !== null &&
                  row.reviewUpdatedAt !== null
                ) {
                  reviewMap.set(row.reviewId, {
                    id: row.reviewId,
                    reviewerId: row.reviewerId,
                    reviewerName: row.reviewerName,
                    reviewerImage: row.reviewerImage,
                    decision: row.reviewDecision,
                    score: row.reviewScore,
                    comment: row.reviewComment,
                    updatedAt: row.reviewUpdatedAt,
                  });
                }
                if (
                  row.emailId !== null &&
                  row.emailType !== null &&
                  row.emailSubject !== null &&
                  row.emailBody !== null &&
                  row.emailStatus !== null &&
                  row.emailCreatedAt !== null
                ) {
                  emailMap.set(row.emailId, {
                    id: row.emailId,
                    contactId: row.emailContactId,
                    recipient: row.emailRecipient,
                    type: row.emailType,
                    subject: row.emailSubject,
                    body: row.emailBody,
                    status: row.emailStatus,
                    sentAt: row.emailSentAt,
                    createdAt: row.emailCreatedAt,
                  });
                }
              }
              const answerMap = new Map<string, ReviewDeskAnswer>();
              const answerStrings = (value: unknown): ReadonlyArray<string> => {
                if (Array.isArray(value)) return value.flatMap(answerStrings);
                if (typeof value === "string") return [value];
                if (typeof value === "number" || typeof value === "boolean") {
                  return [`${value}`];
                }
                return [];
              };
              const answerValue = (row: RawDetailRow): string | ReadonlyArray<string> => {
                const mapped = row.fieldMapsTo;
                if (mapped === "title") return submission.title;
                if (mapped === "description") return submission.description;
                if (mapped === "format_id") return submission.formatName ?? "Not provided";
                if (mapped === "level_id") return submission.levelName ?? "Not provided";
                if (mapped === "tracks") return item.tracks.map((track) => track.name);
                if (mapped === "tags") return item.tags.map((tag) => tag.name);
                if (mapped === "first_name")
                  return Array.from(speakers.values()).flatMap((speaker) =>
                    speaker.contactFirstName === null ? [] : [speaker.contactFirstName],
                  );
                if (mapped === "last_name")
                  return Array.from(speakers.values()).flatMap((speaker) =>
                    speaker.contactLastName === null ? [] : [speaker.contactLastName],
                  );
                if (mapped === "email")
                  return Array.from(speakers.values()).flatMap((speaker) =>
                    speaker.contactEmail === null ? [] : [speaker.contactEmail],
                  );
                if (mapped === "bio")
                  return Array.from(speakers.values()).flatMap((speaker) =>
                    speaker.contactBio === null ? [] : [speaker.contactBio],
                  );
                if (row.fieldId === null) return "Not provided";
                const values =
                  row.fieldSection === "participant"
                    ? Array.from(speakers.values()).flatMap((speaker) => {
                        const value = speaker.contactCustom?.[row.fieldId ?? ""];
                        return answerStrings(value);
                      })
                    : (() => {
                        const value = submission.answers[row.fieldId ?? ""];
                        return answerStrings(value);
                      })();
                return values.length === 0 ? "Not provided" : values;
              };
              for (const row of rows) {
                if (
                  row.fieldId === null ||
                  row.fieldSection === null ||
                  row.fieldLabel === null ||
                  row.fieldType === null ||
                  row.fieldPosition === null ||
                  answerMap.has(row.fieldId)
                ) {
                  continue;
                }
                answerMap.set(row.fieldId, {
                  id: row.fieldId,
                  section: row.fieldSection,
                  label: row.fieldLabel,
                  fieldType: row.fieldType,
                  position: row.fieldPosition,
                  value: answerValue(row),
                });
              }
              // The real merged timeline — activity log, emails, edits,
              // files, tasks — not a reconstruction from row timestamps.
              const activity = yield* loadTimeline(database, eventId, submissionId);
              return yield* decode(ReviewDeskDetail, "submission detail", {
                submission: {
                  ...item,
                  reviewCount: item.reviewCount + roundReviews.length,
                },
                answers: Array.from(answerMap.values()),
                reviews: Array.from(reviewMap.values()),
                roundReviews,
                activity,
                emails: Array.from(emailMap.values()),
              });
            }),
          ),
        );
      },
      evaluationQueue: (viewer, eventId) => {
        const viewerMember = alias(eventMembers, "evaluation_viewer_member");
        const evaluationReviewerTracks = alias(reviewerTracks, "evaluation_reviewer_tracks");
        // Admins see every pending submission; reviewers see the submissions
        // in their assigned tracks — the roster join scopes data, it never
        // gates access (that happened at the boundary).
        const queueQuery = viewer.isAdmin
          ? query(database, "Could not load evaluation queue", (db) =>
              db
                .select(rawListSelection)
                .from(submissions)
                .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
                .innerJoin(tracks, eq(tracks.id, submissionTracks.trackId))
                .leftJoin(formats, eq(formats.id, submissions.formatId))
                .leftJoin(levels, eq(levels.id, submissions.levelId))
                .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
                .leftJoin(submitterContact, eq(submitterContact.id, submissions.submitterContactId))
                .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
                .leftJoin(tags, eq(tags.id, submissionTags.tagId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
                .leftJoin(users, eq(users.id, reviews.reviewerId))
                .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "pending")))
                .orderBy(asc(submissions.submittedAt))
                .execute(),
            )
          : query(database, "Could not load evaluation queue", (db) =>
              db
                .select(rawListSelection)
                .from(submissions)
                .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
                .innerJoin(tracks, eq(tracks.id, submissionTracks.trackId))
                .innerJoin(
                  viewerMember,
                  and(
                    eq(viewerMember.eventId, submissions.eventId),
                    eq(viewerMember.userId, viewer.userId),
                  ),
                )
                .innerJoin(
                  evaluationReviewerTracks,
                  and(
                    eq(evaluationReviewerTracks.trackId, submissionTracks.trackId),
                    eq(evaluationReviewerTracks.eventMemberId, viewerMember.id),
                  ),
                )
                .leftJoin(formats, eq(formats.id, submissions.formatId))
                .leftJoin(levels, eq(levels.id, submissions.levelId))
                .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
                .leftJoin(submitterContact, eq(submitterContact.id, submissions.submitterContactId))
                .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
                .leftJoin(tags, eq(tags.id, submissionTags.tagId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
                .leftJoin(users, eq(users.id, reviews.reviewerId))
                .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "pending")))
                .orderBy(asc(submissions.submittedAt))
                .execute(),
            );
        return queueQuery.pipe(
          Effect.flatMap((rows) =>
            Effect.gen(function* () {
              const first = rows[0];
              if (first === undefined) {
                return yield* Effect.fail(
                  new Forbidden({ message: "No submissions are assigned to you" }),
                );
              }
              const decoded = yield* decodeMany(RawListRow, "evaluation row", rows);
              const items = yield* decodeMany(
                ReviewDeskDetailItem,
                "evaluation submission",
                makeListItems(decoded),
              );
              const reviewMaps = new Map<string, Map<string, ReviewDeskReview>>();
              for (const row of decoded) {
                if (
                  row.reviewId === null ||
                  row.reviewerId === null ||
                  row.reviewerName === null ||
                  row.reviewDecision === null ||
                  row.reviewUpdatedAt === null
                ) {
                  continue;
                }
                const map = reviewMaps.get(row.submissionId) ?? new Map<string, ReviewDeskReview>();
                map.set(row.reviewId, {
                  id: row.reviewId,
                  reviewerId: row.reviewerId,
                  reviewerName: row.reviewerName,
                  reviewerImage: row.reviewerImage,
                  decision: row.reviewDecision,
                  score: row.reviewScore,
                  comment: row.reviewComment,
                  updatedAt: row.reviewUpdatedAt,
                });
                reviewMaps.set(row.submissionId, map);
              }
              const evaluationItems: ReadonlyArray<EvaluationItem> = items.map((submission) => {
                const itemReviews = Array.from(reviewMaps.get(submission.id)?.values() ?? []);
                return {
                  submission,
                  myReview:
                    itemReviews.find((review) => review.reviewerId === viewer.userId) ?? null,
                  reviews: itemReviews,
                };
              });
              const sorted = [...evaluationItems].sort((left, right) => {
                if ((left.myReview === null) !== (right.myReview === null))
                  return left.myReview === null ? -1 : 1;
                return (
                  (left.submission.submittedAt?.getTime() ?? 0) -
                  (right.submission.submittedAt?.getTime() ?? 0)
                );
              });
              const reviewers = new Set(
                sorted.flatMap((item) => item.reviews.map((review) => review.reviewerId)),
              );
              return yield* decode(EvaluationQueue, "evaluation queue", {
                reviewerId: viewer.userId,
                viewerIsAdmin: viewer.isAdmin,
                reviewed: sorted.filter((item) =>
                  viewer.isAdmin ? item.reviews.length > 0 : item.myReview !== null,
                ).length,
                total: sorted.length,
                reviewerCount: reviewers.size,
                items: sorted,
              });
            }),
          ),
        );
      },
      upsertReview: (viewer, input) =>
        query(database, "Could not save review", (db) =>
          db.transaction(async (transaction): Promise<ReviewTransaction> => {
            const member = alias(eventMembers, "review_upsert_member");
            const assignedTrack = alias(reviewerTracks, "review_upsert_track");
            const reviewerRows = await transaction
              .select({ name: users.name, image: users.image })
              .from(users)
              .where(eq(users.id, viewer.userId))
              .limit(1);
            const reviewer = reviewerRows[0];
            if (reviewer === undefined) return { kind: "notFound" };
            const rows = await transaction
              .select({
                submissionId: submissions.id,
                assignedTrackId: assignedTrack.id,
              })
              .from(submissions)
              .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
              .leftJoin(
                member,
                and(eq(member.eventId, submissions.eventId), eq(member.userId, viewer.userId)),
              )
              .leftJoin(
                assignedTrack,
                and(
                  eq(assignedTrack.trackId, submissionTracks.trackId),
                  eq(assignedTrack.eventMemberId, member.id),
                ),
              )
              .where(
                and(
                  eq(submissions.id, input.submissionId),
                  eq(submissions.eventId, input.eventId),
                  eq(submissions.status, "pending"),
                ),
              );
            const first = rows[0];
            if (first === undefined) return { kind: "notFound" };
            // Non-admin reviewers may only score submissions inside their
            // assigned tracks; admins score anything in the event.
            if (!viewer.isAdmin && rows.every((row) => row.assignedTrackId === null)) {
              return { kind: "forbidden" };
            }
            const saved = await transaction
              .insert(reviews)
              .values({
                submissionId: input.submissionId,
                reviewerId: viewer.userId,
                decision: input.decision,
                score: input.score,
                comment: input.comment,
              })
              .onConflictDoUpdate({
                target: [reviews.submissionId, reviews.reviewerId],
                set: {
                  decision: input.decision,
                  score: input.score,
                  comment: input.comment,
                  updatedAt: new Date(),
                },
              })
              .returning();
            return {
              kind: "success",
              review: saved[0] ?? null,
              reviewerName: reviewer.name,
              reviewerImage: reviewer.image,
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound")
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              if (outcome.kind === "forbidden")
                return yield* Effect.fail(
                  new Forbidden({ message: "This submission is outside your tracks" }),
                );
              const review = yield* decodeFound(
                Schema.Struct({
                  id: Schema.String,
                  reviewerId: Schema.String,
                  decision: ReviewDecision,
                  score: NullableNumber,
                  comment: NullableString,
                  updatedAt: Schema.Date,
                }),
                "Review",
                outcome.review,
              );
              return yield* decode(ReviewDeskReview, "review desk review", {
                ...review,
                reviewerName: outcome.reviewerName,
                reviewerImage: outcome.reviewerImage,
              });
            }),
          ),
        ),
      changeStatus: (eventId, submissionId, status, actor) => {
        if (status === "accepted" || status === "declined" || status === "draft") {
          return Effect.fail(
            new InvalidInput({
              message:
                status === "draft"
                  ? "Draft status is controlled by the submission form"
                  : "Accept and decline require the decision dialog",
            }),
          );
        }
        return query(database, "Could not change submission status", (db) =>
          db.transaction(
            async (
              transaction,
            ): Promise<
              | { readonly kind: "notFound" }
              | { readonly kind: "accepted" }
              | { readonly kind: "success"; readonly row: { id: string; status: string } }
            > => {
              const current = (
                await transaction
                  .select({ id: submissions.id, status: submissions.status })
                  .from(submissions)
                  .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, eventId)))
                  .for("update")
              )[0];
              if (current === undefined) return { kind: "notFound" };
              // Acceptance is not undone by a status shuffle: the only exits
              // from accepted are cancelling the session (or reinstating it).
              if (current.status === "accepted") return { kind: "accepted" };
              if (current.status === status) return { kind: "success", row: current };
              const updated = (
                await transaction
                  .update(submissions)
                  .set({ status, updatedAt: new Date() })
                  .where(eq(submissions.id, submissionId))
                  .returning({ id: submissions.id, status: submissions.status })
              )[0];
              if (updated === undefined) return { kind: "notFound" };
              await transaction.insert(submissionActivity).values({
                submissionId,
                type: "status_changed",
                ...activityActorColumns(actor),
                payload: { from: current.status, to: status },
              });
              return { kind: "success", row: updated };
            },
          ),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound") {
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              }
              if (outcome.kind === "accepted") {
                return yield* Effect.fail(
                  new InvalidInput({
                    message:
                      "This submission was accepted — cancel its session instead of changing the status",
                  }),
                );
              }
              return yield* decodeFound(StatusChangeResult, "Submission", outcome.row);
            }),
          ),
        );
      },
      decide: (input) => {
        const uniqueIds = Array.from(new Set(input.submissionIds));
        if (uniqueIds.length === 0) {
          return Effect.fail(new InvalidInput({ message: "Select at least one submission" }));
        }
        return query(database, "Could not apply submission decision", (db) =>
          db.transaction(async (transaction): Promise<DecisionTransaction> => {
            const targetRows = await transaction
              .select({
                submissionId: submissions.id,
                status: submissions.status,
                cancelledAt: submissions.cancelledAt,
                notifiedAt: submissions.notifiedAt,
                speakerConfirmationEnabled: events.speakerConfirmationEnabled,
                contactId: contacts.id,
              })
              .from(submissions)
              .innerJoin(
                events,
                and(eq(events.id, submissions.eventId), eq(events.id, input.eventId)),
              )
              .leftJoin(
                submissionParticipants,
                // Participant roles are form-configured labels ("speaker",
                // "Primary speaker", "Co-presenter"); every participant is a
                // presenting speaker, so no role filter.
                eq(submissionParticipants.submissionId, submissions.id),
              )
              .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
              .where(inArray(submissions.id, uniqueIds))
              .for("update", { of: submissions });
            const foundIds = new Set(targetRows.map((row) => row.submissionId));
            if (foundIds.size !== uniqueIds.length) return { kind: "notFound" };
            if (targetRows.some((row) => row.status === "draft" || row.status === "withdrawn")) {
              return {
                kind: "invalid",
                message: "Draft and withdrawn submissions cannot be decided",
              };
            }
            if (
              input.decision === "accept" &&
              targetRows.some((row) => row.status === "accepted" && row.cancelledAt !== null)
            ) {
              return {
                kind: "invalid",
                message: "This session was cancelled — reinstate it from Sessions instead",
              };
            }
            const nextStatus: "accepted" | "declined" =
              input.decision === "accept" ? "accepted" : "declined";
            // The only surviving re-decide: declined → accepted.
            const priorFinal = targetRows.find((row) =>
              decisionConfirmationRequired(row.status, row.notifiedAt, nextStatus),
            );
            if (priorFinal !== undefined && !input.confirmRedecide) {
              return {
                kind: "alreadyDecided",
                message: "This submission already has a decision. Confirm to replace it.",
              };
            }
            const now = new Date();
            const confirmationRequested = targetRows[0]?.speakerConfirmationEnabled === true;
            const templates = await transaction
              .select()
              .from(taskTemplates)
              .where(
                and(
                  eq(taskTemplates.eventId, input.eventId),
                  eq(taskTemplates.autoAssignOnAccept, true),
                ),
              );
            const requirements = await transaction
              .select()
              .from(sessionFileRequirements)
              .where(eq(sessionFileRequirements.eventId, input.eventId));
            let createdTasks = 0;
            if (input.decision === "accept") {
              const todo = "todo" as const;
              const distinctContacts = Array.from(
                new Map(
                  targetRows.flatMap((row) =>
                    row.contactId === null ? [] : [[row.contactId, row.contactId]],
                  ),
                ).values(),
              );
              // With speaker confirmation on, confirming is the speaker's own
              // act in the portal; with it off, acceptance confirms everyone.
              if (!confirmationRequested && distinctContacts.length > 0) {
                await transaction
                  .update(contacts)
                  .set({ confirmedAt: now, updatedAt: now })
                  .where(and(inArray(contacts.id, distinctContacts), isNull(contacts.confirmedAt)));
              }
              const contactAssignments = templates
                .filter((template) => template.scope === "contact")
                .flatMap((template) =>
                  distinctContacts.map((contactId) => ({
                    taskTemplateId: template.id,
                    contactId,
                    submissionId: null,
                    status: todo,
                    completedAt: null,
                  })),
                );
              const submissionAssignments = templates
                .filter((template) => template.scope === "submission")
                .flatMap((template) =>
                  uniqueIds.map((submissionId) => ({
                    taskTemplateId: template.id,
                    contactId: null,
                    submissionId,
                    status: todo,
                    completedAt: null,
                  })),
                );
              const assignments = [...contactAssignments, ...submissionAssignments];
              if (assignments.length > 0) {
                const inserted = await transaction
                  .insert(taskAssignments)
                  .values(assignments)
                  .onConflictDoNothing()
                  .returning({ id: taskAssignments.id });
                createdTasks = inserted.length;
              }
              const participantsBySubmission = new Map<string, Set<string>>();
              for (const row of targetRows) {
                if (row.contactId === null) continue;
                const contactIds = participantsBySubmission.get(row.submissionId) ?? new Set();
                contactIds.add(row.contactId);
                participantsBySubmission.set(row.submissionId, contactIds);
              }
              const fileAssignments: Array<typeof sessionFileRequirementAssignments.$inferInsert> =
                [];
              for (const requirement of requirements) {
                for (const submissionId of uniqueIds) {
                  if (requirement.scope === "submission") {
                    fileAssignments.push({
                      requirementId: requirement.id,
                      submissionId,
                      contactId: null,
                      status: "outstanding",
                    });
                    continue;
                  }
                  for (const contactId of participantsBySubmission.get(submissionId) ?? []) {
                    fileAssignments.push({
                      requirementId: requirement.id,
                      submissionId,
                      contactId,
                      status: "outstanding",
                    });
                  }
                }
              }
              if (fileAssignments.length > 0) {
                await transaction
                  .insert(sessionFileRequirementAssignments)
                  .values(fileAssignments)
                  .onConflictDoNothing();
              }
            }
            const updated = await transaction
              .update(submissions)
              // Accepting makes the row a session (the Sessions surface is
              // the projection of accepted submissions) while it keeps its
              // code, reviews, and history on the desk. Acceptance does NOT
              // publish: content stays pending_review (public surfaces filter
              // on approved) unless the organizer opted into
              // approve-on-accept, which snapshots the current content as the
              // approved public version. A previously approved session keeps
              // its approval on re-accept.
              .set({
                ...decisionFactUpdate(nextStatus, now),
                ...(nextStatus === "accepted"
                  ? input.approveContent
                    ? {
                        contentReviewStatus: "approved" as const,
                        approvedSnapshot: sql`jsonb_build_object('title', ${submissions.title}, 'description', ${submissions.description}, 'formatId', ${submissions.formatId}, 'levelId', ${submissions.levelId}, 'language', ${submissions.language}, 'answers', ${submissions.answers})`,
                      }
                    : {
                        contentReviewStatus: sql`case when ${submissions.approvedSnapshot} = '{}'::jsonb then 'pending_review' else ${submissions.contentReviewStatus} end`,
                      }
                  : {}),
              })
              .where(and(inArray(submissions.id, uniqueIds), ne(submissions.status, nextStatus)))
              .returning({
                id: submissions.id,
                status: submissions.status,
                notifiedAt: submissions.notifiedAt,
              });
            if (updated.length > 0) {
              const previousStatus = new Map(
                targetRows.map((row) => [row.submissionId, row.status]),
              );
              await transaction.insert(submissionActivity).values(
                updated.map((submission) => ({
                  submissionId: submission.id,
                  type: "decided" as const,
                  ...activityActorColumns(input.actor),
                  payload: {
                    decision: input.decision,
                    from: previousStatus.get(submission.id) ?? "pending",
                  },
                })),
              );
            }
            const updatedMap = new Map(updated.map((submission) => [submission.id, submission]));
            const originalMap = new Map(
              targetRows.map((submission) => [submission.submissionId, submission]),
            );
            return {
              kind: "success",
              result: {
                submissions: uniqueIds.flatMap((submissionId) => {
                  const submission = updatedMap.get(submissionId) ?? originalMap.get(submissionId);
                  return submission === undefined
                    ? []
                    : [{ id: submissionId, status: nextStatus, notifiedAt: submission.notifiedAt }];
                }),
                createdTasks,
              },
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound")
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              if (outcome.kind === "invalid")
                return yield* Effect.fail(new InvalidInput({ message: outcome.message }));
              if (outcome.kind === "alreadyDecided")
                return yield* Effect.fail(new AlreadyDecided({ message: outcome.message }));
              const result = yield* decode(DecisionResult, "decision result", outcome.result);
              return { ...outcome, result };
            }),
          ),
        );
      },
      inform: (input) => {
        const uniqueIds = Array.from(new Set(input.submissionIds));
        if (uniqueIds.length === 0) {
          return Effect.fail(new InvalidInput({ message: "Select at least one decision" }));
        }
        return query(database, "Could not inform submitters", (db) =>
          db.transaction(async (transaction): Promise<InformTransaction> => {
            const rows = await transaction
              .select({
                id: submissions.id,
                status: submissions.status,
                notifiedAt: submissions.notifiedAt,
                title: submissions.title,
                submitterContactId: submissions.submitterContactId,
                eventName: events.name,
                speakerConfirmationEnabled: events.speakerConfirmationEnabled,
                email: emailRecipient.email,
                firstName: emailRecipient.firstName,
              })
              .from(submissions)
              .innerJoin(
                events,
                and(eq(events.id, submissions.eventId), eq(events.id, input.eventId)),
              )
              .leftJoin(emailRecipient, eq(emailRecipient.id, submissions.submitterContactId))
              .where(inArray(submissions.id, uniqueIds))
              .for("update", { of: submissions });
            if (rows.length !== uniqueIds.length) return { kind: "notFound" };
            const validationError = informValidationError(rows);
            if (validationError !== null) return { kind: "invalid", message: validationError };
            const now = new Date();
            const candidates = rows.flatMap((row) => {
              if (
                row.submitterContactId === null ||
                row.email === null ||
                row.firstName === null ||
                (row.status !== "accepted" && row.status !== "declined")
              ) {
                return [];
              }
              const rendered = renderDecisionEmail({
                decision: row.status === "accepted" ? "accept" : "decline",
                eventName: row.eventName,
                speakerName: row.firstName,
                submissionTitle: row.title,
                feedback: input.feedback,
                confirmationRequested: row.speakerConfirmationEnabled,
              });
              return [
                decisionEmailLogValue({
                  eventId: input.eventId,
                  submissionId: row.id,
                  submitterContactId: row.submitterContactId,
                  decision: row.status,
                  recipient: row.email,
                  subject: rendered.subject,
                  text: rendered.text,
                  html: rendered.html,
                }),
              ];
            });
            const inserted = await transaction
              .insert(emailLog)
              .values(candidates)
              .returning({ id: emailLog.id });
            const informed = await transaction
              .update(submissions)
              .set(informFactUpdate(now))
              .where(
                and(
                  inArray(submissions.id, uniqueIds),
                  isNull(submissions.notifiedAt),
                  inArray(submissions.status, ["accepted", "declined"]),
                ),
              )
              .returning({ id: submissions.id });
            if (informed.length !== uniqueIds.length || inserted.length !== uniqueIds.length) {
              return { kind: "invalid", message: "These decisions changed while informing" };
            }
            await transaction.insert(submissionActivity).values(
              informed.map((submission) => ({
                submissionId: submission.id,
                type: "informed" as const,
                ...activityActorColumns(input.actor),
                payload: {},
              })),
            );
            return {
              kind: "success",
              result: { queued: inserted.length },
              logIds: inserted.map((row) => row.id),
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound") {
                return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
              }
              if (outcome.kind === "invalid") {
                return yield* Effect.fail(new InvalidInput({ message: outcome.message }));
              }
              return {
                result: yield* decode(InformResult, "inform result", outcome.result),
                logIds: outcome.logIds,
              };
            }),
          ),
        );
      },
      markEmail: (logId, status) =>
        query(database, "Could not update decision email", (db) =>
          db
            .update(emailLog)
            .set({
              status,
              sentAt: status === "sent" ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(emailLog.id, logId))
            .execute(),
        ).pipe(Effect.asVoid),
    };
  }),
);
