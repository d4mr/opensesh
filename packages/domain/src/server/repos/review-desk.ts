import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
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
  organizationMembers,
  reviewerTracks,
  reviews,
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
import type { SessionIdentity } from "../current-user";
import { Db, type Database } from "../db";
import { AlreadyDecided, type DbError, Forbidden, InvalidInput, NotFound } from "../errors";
import type { OutboundMail } from "../mail";
import { JsonObject, NullableDate, NullableNumber, NullableString } from "../schema/common";
import { FormFieldType, FormSection } from "../schema/forms";
import {
  DecisionResult,
  type EvaluationItem,
  EvaluationQueue,
  type ReviewDeskAnswer,
  ReviewDeskDetail,
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
import { ReviewDecision, SubmissionKind, SubmissionStatus } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

const RawListRow = Schema.Struct({
  submissionId: Schema.String,
  eventId: Schema.String,
  code: Schema.String,
  kind: SubmissionKind,
  status: SubmissionStatus,
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

interface MutableListItem {
  readonly base: Omit<
    ReviewDeskListItem,
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
          kind: row.kind,
          status: row.status,
          title: row.title,
          description: row.description,
          format: row.formatName,
          source: row.sourceName ?? "Manual",
          submittedAt: row.submittedAt,
          createdAt: row.createdAt,
          notifiedAt: row.notifiedAt,
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
  kind: submissions.kind,
  status: submissions.status,
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
  reviewId: reviews.id,
  reviewerId: reviews.reviewerId,
  reviewerName: users.name,
  reviewerImage: users.image,
  reviewDecision: reviews.decision,
  reviewScore: reviews.score,
  reviewComment: reviews.comment,
  reviewUpdatedAt: reviews.updatedAt,
};

const listQuery = (
  database: Database,
  session: SessionIdentity,
  eventSlug: string,
  eventId: string,
  kind: typeof SubmissionKind.Type,
) => {
  const scopeMember = alias(eventMembers, "review_desk_list_member");
  return query(database, "Could not load submissions", (db) =>
    db
      .select(rawListSelection)
      .from(events)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, events.organizationId),
          eq(organizationMembers.userId, session.userId),
        ),
      )
      .innerJoin(
        scopeMember,
        and(
          eq(scopeMember.eventId, events.id),
          eq(scopeMember.userId, session.userId),
          eq(scopeMember.role, "admin"),
        ),
      )
      .innerJoin(
        submissions,
        and(
          eq(submissions.eventId, events.id),
          eq(submissions.kind, kind),
          eq(submissions.eventId, eventId),
        ),
      )
      .leftJoin(formats, eq(formats.id, submissions.formatId))
      .leftJoin(levels, eq(levels.id, submissions.levelId))
      .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
      .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
      .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
      .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
      .leftJoin(tags, eq(tags.id, submissionTags.tagId))
      .leftJoin(submissionParticipants, eq(submissionParticipants.submissionId, submissions.id))
      .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .leftJoin(eventMembers, eq(eventMembers.id, reviews.reviewerId))
      .leftJoin(users, eq(users.id, eventMembers.userId))
      .where(
        and(
          eq(events.slug, eventSlug),
          session.activeOrganizationId === undefined
            ? undefined
            : eq(events.organizationId, session.activeOrganizationId),
        ),
      )
      .orderBy(desc(submissions.submittedAt), desc(submissions.createdAt))
      .execute(),
  );
};

type ReviewDeskFailure = DbError | Forbidden | InvalidInput | NotFound | AlreadyDecided;

interface DecisionDelivery {
  readonly logId: string;
  readonly mail: OutboundMail;
}

interface DecisionSuccess {
  readonly kind: "success";
  readonly result: typeof DecisionResult.Type;
  readonly deliveries: ReadonlyArray<DecisionDelivery>;
}

type DecisionTransaction =
  | DecisionSuccess
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "alreadyDecided"; readonly message: string };

type ReviewTransaction =
  | { readonly kind: "notFound" }
  | { readonly kind: "forbidden" }
  | {
      readonly kind: "success";
      readonly review: typeof reviews.$inferSelect | null;
      readonly reviewerName: string;
      readonly reviewerImage: string | null;
    };

interface ReviewDeskService {
  readonly list: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
    kind: typeof SubmissionKind.Type,
  ) => Effect.Effect<ReviewDeskList, DbError | Forbidden>;
  readonly detail: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
    submissionId: string,
  ) => Effect.Effect<typeof ReviewDeskDetail.Type, DbError | NotFound>;
  readonly evaluationQueue: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
  ) => Effect.Effect<typeof EvaluationQueue.Type, DbError | Forbidden>;
  readonly upsertReview: (
    session: SessionIdentity,
    eventSlug: string,
    input: {
      readonly eventId: string;
      readonly submissionId: string;
      readonly decision: typeof ReviewDecision.Type;
      readonly score: number;
      readonly comment: string | null;
    },
  ) => Effect.Effect<ReviewDeskReview, DbError | Forbidden | NotFound>;
  readonly changeStatus: (
    eventSlug: string,
    eventId: string,
    submissionId: string,
    status: typeof SubmissionStatus.Type,
  ) => Effect.Effect<typeof StatusChangeResult.Type, DbError | InvalidInput | NotFound>;
  readonly decide: (
    eventSlug: string,
    input: {
      readonly eventId: string;
      readonly submissionIds: ReadonlyArray<string>;
      readonly decision: SubmissionDecision;
      readonly feedback: string;
      readonly confirmRedecide: boolean;
    },
  ) => Effect.Effect<DecisionSuccess, ReviewDeskFailure>;
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
      list: (session, eventSlug, eventId, kind) =>
        listQuery(database, session, eventSlug, eventId, kind).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new Forbidden({ message: "You cannot manage these submissions" }),
          ),
          Effect.flatMap((rows) => decodeMany(RawListRow, "review desk row", rows)),
          Effect.flatMap((rows) =>
            decodeMany(ReviewDeskListItem, "review desk submission", makeListItems(rows)),
          ),
          Effect.flatMap((items) => {
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
            });
          }),
        ),
      detail: (session, eventSlug, eventId, submissionId) => {
        const scopeMember = alias(eventMembers, "review_desk_detail_member");
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
            .from(events)
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, events.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              scopeMember,
              and(
                eq(scopeMember.eventId, events.id),
                eq(scopeMember.userId, session.userId),
                eq(scopeMember.role, "admin"),
              ),
            )
            .innerJoin(
              submissions,
              and(
                eq(submissions.id, submissionId),
                eq(submissions.eventId, events.id),
                eq(submissions.eventId, eventId),
              ),
            )
            .leftJoin(formats, eq(formats.id, submissions.formatId))
            .leftJoin(levels, eq(levels.id, submissions.levelId))
            .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
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
            .leftJoin(eventMembers, eq(eventMembers.id, reviews.reviewerId))
            .leftJoin(users, eq(users.id, eventMembers.userId))
            .leftJoin(emailLog, eq(emailLog.submissionId, submissions.id))
            .leftJoin(emailRecipient, eq(emailRecipient.id, emailLog.contactId))
            .where(
              and(
                eq(events.slug, eventSlug),
                session.activeOrganizationId === undefined
                  ? undefined
                  : eq(events.organizationId, session.activeOrganizationId),
              ),
            )
            .orderBy(asc(formFields.position), asc(reviews.createdAt), desc(emailLog.createdAt))
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
              const activity = [
                { id: "created", label: "Submission created", at: submission.createdAt },
                ...(submission.submittedAt === null
                  ? []
                  : [
                      {
                        id: "submitted",
                        label: "Submitted for review",
                        at: submission.submittedAt,
                      },
                    ]),
                ...(submission.updatedAt.getTime() === submission.createdAt.getTime()
                  ? []
                  : [
                      {
                        id: "status",
                        label: `Status is ${submission.status}`,
                        at: submission.updatedAt,
                      },
                    ]),
                ...(submission.notifiedAt === null
                  ? []
                  : [
                      {
                        id: "notified",
                        label: "Decision notification sent",
                        at: submission.notifiedAt,
                      },
                    ]),
              ].sort((left, right) => right.at.getTime() - left.at.getTime());
              return yield* decode(ReviewDeskDetail, "submission detail", {
                submission: item,
                answers: Array.from(answerMap.values()),
                reviews: Array.from(reviewMap.values()),
                activity,
                emails: Array.from(emailMap.values()),
              });
            }),
          ),
        );
      },
      evaluationQueue: (session, eventSlug, eventId) => {
        const viewerMember = alias(eventMembers, "evaluation_viewer_member");
        const reviewMember = alias(eventMembers, "evaluation_review_member");
        const evaluationReviewerTracks = alias(reviewerTracks, "evaluation_reviewer_tracks");
        return query(database, "Could not load evaluation queue", (db) =>
          db
            .select({
              ...rawListSelection,
              reviewerId: reviews.reviewerId,
              reviewerName: users.name,
              reviewerImage: users.image,
              viewerMemberId: viewerMember.id,
              viewerRole: viewerMember.role,
            })
            .from(events)
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, events.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              viewerMember,
              and(eq(viewerMember.eventId, events.id), eq(viewerMember.userId, session.userId)),
            )
            .innerJoin(
              submissions,
              and(
                eq(submissions.eventId, events.id),
                eq(submissions.eventId, eventId),
                eq(submissions.status, "pending"),
              ),
            )
            .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .innerJoin(tracks, eq(tracks.id, submissionTracks.trackId))
            .leftJoin(
              evaluationReviewerTracks,
              and(
                eq(evaluationReviewerTracks.trackId, submissionTracks.trackId),
                eq(evaluationReviewerTracks.eventMemberId, viewerMember.id),
              ),
            )
            .leftJoin(formats, eq(formats.id, submissions.formatId))
            .leftJoin(levels, eq(levels.id, submissions.levelId))
            .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
            .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
            .leftJoin(tags, eq(tags.id, submissionTags.tagId))
            .leftJoin(
              submissionParticipants,
              eq(submissionParticipants.submissionId, submissions.id),
            )
            .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
            .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
            .leftJoin(reviewMember, eq(reviewMember.id, reviews.reviewerId))
            .leftJoin(users, eq(users.id, reviewMember.userId))
            .where(
              and(
                eq(events.slug, eventSlug),
                or(eq(viewerMember.role, "admin"), isNotNull(evaluationReviewerTracks.id)),
                session.activeOrganizationId === undefined
                  ? undefined
                  : eq(events.organizationId, session.activeOrganizationId),
              ),
            )
            .orderBy(asc(submissions.submittedAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.gen(function* () {
              const first = rows[0];
              if (first === undefined) {
                return yield* Effect.fail(
                  new Forbidden({ message: "No submissions are assigned to you" }),
                );
              }
              const queueRows = rows.map(
                ({ viewerMemberId: _memberId, viewerRole: _role, ...row }) => row,
              );
              const decoded = yield* decodeMany(RawListRow, "evaluation row", queueRows);
              const items = yield* decodeMany(
                ReviewDeskListItem,
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
                    itemReviews.find((review) => review.reviewerId === first.viewerMemberId) ??
                    null,
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
                reviewerId: first.viewerMemberId,
                viewerIsAdmin: first.viewerRole === "admin",
                reviewed: sorted.filter((item) =>
                  first.viewerRole === "admin" ? item.reviews.length > 0 : item.myReview !== null,
                ).length,
                total: sorted.length,
                reviewerCount: reviewers.size,
                items: sorted,
              });
            }),
          ),
        );
      },
      upsertReview: (session, eventSlug, input) =>
        query(database, "Could not save review", (db) =>
          db.transaction(async (transaction): Promise<ReviewTransaction> => {
            const member = alias(eventMembers, "review_upsert_member");
            const assignedTrack = alias(reviewerTracks, "review_upsert_track");
            const rows = await transaction
              .select({
                memberId: member.id,
                memberRole: member.role,
                reviewerName: users.name,
                reviewerImage: users.image,
                assignedTrackId: assignedTrack.id,
              })
              .from(events)
              .innerJoin(
                organizationMembers,
                and(
                  eq(organizationMembers.organizationId, events.organizationId),
                  eq(organizationMembers.userId, session.userId),
                ),
              )
              .innerJoin(
                member,
                and(eq(member.eventId, events.id), eq(member.userId, session.userId)),
              )
              .innerJoin(users, eq(users.id, member.userId))
              .innerJoin(
                submissions,
                and(
                  eq(submissions.id, input.submissionId),
                  eq(submissions.eventId, events.id),
                  eq(submissions.eventId, input.eventId),
                  eq(submissions.status, "pending"),
                ),
              )
              .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
              .leftJoin(
                assignedTrack,
                and(
                  eq(assignedTrack.trackId, submissionTracks.trackId),
                  eq(assignedTrack.eventMemberId, member.id),
                ),
              )
              .where(eq(events.slug, eventSlug));
            const first = rows[0];
            if (first === undefined) return { kind: "notFound" };
            if (first.memberRole !== "admin" && rows.every((row) => row.assignedTrackId === null)) {
              return { kind: "forbidden" };
            }
            const saved = await transaction
              .insert(reviews)
              .values({
                submissionId: input.submissionId,
                reviewerId: first.memberId,
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
              reviewerName: first.reviewerName,
              reviewerImage: first.reviewerImage,
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
      changeStatus: (eventSlug, eventId, submissionId, status) => {
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
          db
            .update(submissions)
            .set({ status, updatedAt: new Date() })
            .where(
              and(
                eq(submissions.id, submissionId),
                eq(submissions.eventId, eventId),
                inArray(
                  submissions.eventId,
                  db.select({ id: events.id }).from(events).where(eq(events.slug, eventSlug)),
                ),
              ),
            )
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(StatusChangeResult, "Submission", rows[0])));
      },
      decide: (eventSlug, input) => {
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
                notifiedAt: submissions.notifiedAt,
                title: submissions.title,
                eventId: submissions.eventId,
                eventName: events.name,
                contactId: contacts.id,
                contactEmail: contacts.email,
                contactFirstName: contacts.firstName,
              })
              .from(submissions)
              .innerJoin(
                events,
                and(
                  eq(events.id, submissions.eventId),
                  eq(events.slug, eventSlug),
                  eq(events.id, input.eventId),
                ),
              )
              .leftJoin(
                submissionParticipants,
                and(
                  eq(submissionParticipants.submissionId, submissions.id),
                  eq(submissionParticipants.role, "speaker"),
                ),
              )
              .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
              .where(inArray(submissions.id, uniqueIds))
              .for("update", { of: submissions });
            const foundIds = new Set(targetRows.map((row) => row.submissionId));
            if (foundIds.size !== uniqueIds.length) return { kind: "notFound" };
            if (targetRows.some((row) => row.status === "draft" || row.status === "withdrawn")) {
              return {
                kind: "invalid",
                message: "Draft and withdrawn submissions cannot receive decision emails",
              };
            }
            const nextStatus: "accepted" | "declined" =
              input.decision === "accept" ? "accepted" : "declined";
            const priorFinal = targetRows.find(
              (row) =>
                (row.status === "accepted" || row.status === "declined") &&
                row.status !== nextStatus,
            );
            if (priorFinal !== undefined && !input.confirmRedecide) {
              return {
                kind: "alreadyDecided",
                message: "This submission already has a decision. Confirm to replace it.",
              };
            }
            if (
              targetRows.some(
                (row) =>
                  row.contactId === null ||
                  row.contactEmail === null ||
                  row.contactFirstName === null,
              )
            ) {
              return { kind: "invalid", message: "Every submission must have a speaker" };
            }
            const now = new Date();
            const templates = await transaction
              .select()
              .from(taskTemplates)
              .where(
                and(
                  eq(taskTemplates.eventId, input.eventId),
                  eq(taskTemplates.autoAssignOnAccept, true),
                ),
              );
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
              if (distinctContacts.length > 0) {
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
            }
            const candidates = targetRows.flatMap((row) => {
              if (
                row.contactId === null ||
                row.contactEmail === null ||
                row.contactFirstName === null
              ) {
                return [];
              }
              const rendered = renderDecisionEmail({
                decision: input.decision,
                eventName: row.eventName,
                speakerName: row.contactFirstName,
                submissionTitle: row.title,
                feedback: input.feedback,
              });
              return [
                {
                  key: `${row.submissionId}:${row.contactId}`,
                  submissionId: row.submissionId,
                  contactId: row.contactId,
                  to: row.contactEmail,
                  subject: rendered.subject,
                  body: rendered.text,
                  html: rendered.html,
                  eventId: row.eventId,
                },
              ];
            });
            const queued = "queued" as const;
            const insertedEmails =
              candidates.length === 0
                ? []
                : await transaction
                    .insert(emailLog)
                    .values(
                      candidates.map((candidate) => ({
                        eventId: candidate.eventId,
                        contactId: candidate.contactId,
                        submissionId: candidate.submissionId,
                        type: nextStatus,
                        recipient: candidate.to,
                        subject: candidate.subject,
                        body: candidate.body,
                        htmlBody: candidate.html,
                        icsAttached: false,
                        icsContent: null,
                        icsSequence: null,
                        status: queued,
                        provider: null,
                        providerId: null,
                        error: null,
                        sentAt: null,
                      })),
                    )
                    .returning({
                      id: emailLog.id,
                      contactId: emailLog.contactId,
                      submissionId: emailLog.submissionId,
                    });
            const candidateMap = new Map(candidates.map((candidate) => [candidate.key, candidate]));
            const deliveries = insertedEmails.flatMap((email) => {
              if (email.contactId === null || email.submissionId === null) return [];
              const candidate = candidateMap.get(`${email.submissionId}:${email.contactId}`);
              return candidate === undefined
                ? []
                : [
                    {
                      logId: email.id,
                      mail: {
                        to: candidate.to,
                        subject: candidate.subject,
                        text: candidate.body,
                        html: candidate.html,
                      },
                    },
                  ];
            });
            const updated = await transaction
              .update(submissions)
              .set({ status: nextStatus, notifiedAt: now, updatedAt: now })
              .where(
                and(
                  inArray(submissions.id, uniqueIds),
                  or(ne(submissions.status, nextStatus), isNull(submissions.notifiedAt)),
                ),
              )
              .returning({
                id: submissions.id,
                status: submissions.status,
                notifiedAt: submissions.notifiedAt,
              });
            const updatedMap = new Map(updated.map((submission) => [submission.id, submission]));
            const originalMap = new Map(
              targetRows.map((submission) => [submission.submissionId, submission]),
            );
            return {
              kind: "success",
              result: {
                submissions: uniqueIds.flatMap((submissionId) => {
                  const submission = updatedMap.get(submissionId) ?? originalMap.get(submissionId);
                  return submission === undefined || submission.notifiedAt === null
                    ? []
                    : [
                        {
                          id: submissionId,
                          status: nextStatus,
                          notifiedAt: submission.notifiedAt,
                        },
                      ];
                }),
                createdTasks,
                createdEmails: insertedEmails.length,
              },
              deliveries,
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
