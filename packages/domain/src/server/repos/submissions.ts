import { and, asc, countDistinct, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer } from "effect";

import {
  contacts,
  eventMembers,
  events,
  forms,
  organizationMembers,
  reviews,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tracks,
  users,
} from "../../db/schema";
import { Db } from "../db";
import type { SessionIdentity } from "../current-user";
import { DbError, Forbidden, FormClosed, type NotFound, SubmissionLimitReached } from "../errors";
import { Event } from "../schema/core";
import { Form } from "../schema/forms";
import {
  type DashboardSubmission,
  DashboardSubmissionRow,
  Submission,
  type SubmissionCreate,
  SubmissionParticipant,
  type SubmissionParticipantCreate,
  SubmissionTag,
  type SubmissionStatus,
  SubmissionTrack,
  type SubmissionUpdate,
} from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface SubmissionsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Submission>, DbError>;
  readonly listDashboardByEvent: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<DashboardSubmission>, DbError>;
  readonly loadDashboard: (
    session: SessionIdentity,
    eventSlug: string,
  ) => Effect.Effect<DashboardStats, DbError | Forbidden>;
  readonly listByFormContact: (
    formId: string,
    contactId: string,
  ) => Effect.Effect<ReadonlyArray<Submission>, DbError>;
  readonly get: (id: string) => Effect.Effect<Submission, DbError | NotFound>;
  readonly allocateCode: (eventId: string) => Effect.Effect<string, DbError>;
  readonly create: (input: SubmissionCreate) => Effect.Effect<Submission, DbError>;
  readonly saveDraft: (
    input: SubmissionCreate,
    id: string | null,
  ) => Effect.Effect<
    Submission,
    DbError | Forbidden | FormClosed | NotFound | SubmissionLimitReached
  >;
  readonly submitDraft: (
    id: string,
    contactId: string,
  ) => Effect.Effect<Submission, DbError | Forbidden | FormClosed | NotFound>;
  readonly update: (
    id: string,
    input: SubmissionUpdate,
  ) => Effect.Effect<Submission, DbError | NotFound>;
  readonly changeStatus: (
    id: string,
    status: SubmissionStatus,
    notifiedAt?: Date | null,
  ) => Effect.Effect<Submission, DbError | NotFound>;
  readonly replaceTrackIds: (
    submissionId: string,
    trackIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<SubmissionTrack>, DbError>;
  readonly replaceTagIds: (
    submissionId: string,
    tagIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<SubmissionTag>, DbError>;
  readonly replaceParticipants: (
    submissionId: string,
    participants: ReadonlyArray<SubmissionParticipantCreate>,
  ) => Effect.Effect<ReadonlyArray<SubmissionParticipant>, DbError>;
  readonly listParticipants: (
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<SubmissionParticipant>, DbError>;
  readonly listTrackIds: (submissionId: string) => Effect.Effect<ReadonlyArray<string>, DbError>;
  readonly listTagIds: (submissionId: string) => Effect.Effect<ReadonlyArray<string>, DbError>;
}

export class Submissions extends Context.Service<Submissions, SubmissionsService>()(
  "opensesh/Submissions",
) {}

export interface DashboardStats {
  readonly submissions: number;
  readonly pending: number;
  readonly accepted: number;
  readonly speakers: number;
  readonly activity: ReadonlyArray<{
    readonly date: string;
    readonly abstracts: number;
    readonly sessions: number;
  }>;
  readonly recentSubmissions: ReadonlyArray<DashboardSubmission>;
}

export const SubmissionsLive = Layer.effect(
  Submissions,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const allocateCode = (eventId: string) =>
      query(database, "Could not allocate a submission code", (db) =>
        db
          .select({ code: submissions.code })
          .from(submissions)
          .where(eq(submissions.eventId, eventId))
          .execute(),
      ).pipe(
        Effect.map((rows) => {
          const current = rows.reduce((maximum, row) => {
            const value = Number.parseInt(row.code.replace(/^SESS-/, ""), 10);
            return Number.isNaN(value) ? maximum : Math.max(maximum, value);
          }, 0);
          return `SESS-${current + 1}`;
        }),
      );

    const loadForm = (formId: string) =>
      query(database, "Could not load submission form", (db) =>
        db.select().from(forms).where(eq(forms.id, formId)).limit(1).execute(),
      ).pipe(Effect.flatMap((rows) => decodeFound(Form, "Form", rows[0])));

    const assertOpen = (form: Form) =>
      form.status === "closed" || (form.closeDate !== null && form.closeDate <= new Date())
        ? Effect.fail(new FormClosed({ message: "This submission form is closed" }))
        : Effect.succeed(undefined);

    const dashboardContactCounts = database
      .select({ eventId: contacts.eventId, speakers: countDistinct(contacts.id).as("speakers") })
      .from(contacts)
      .groupBy(contacts.eventId)
      .as("dashboard_contact_counts");
    const staffMember = alias(eventMembers, "dashboard_staff_member");
    const reviewerMember = alias(eventMembers, "dashboard_reviewer_member");

    return {
      listByEvent: (eventId) =>
        query(database, "Could not list submissions", (db) =>
          db
            .select()
            .from(submissions)
            .where(eq(submissions.eventId, eventId))
            .orderBy(desc(submissions.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Submission, "submission", rows))),
      listDashboardByEvent: (eventId) =>
        query(database, "Could not list dashboard submissions", (db) =>
          db
            .select({
              submissionId: submissions.id,
              code: submissions.code,
              title: submissions.title,
              kind: submissions.kind,
              status: submissions.status,
              createdAt: submissions.createdAt,
              trackName: tracks.name,
              reviewerName: users.name,
              reviewerImage: users.image,
            })
            .from(submissions)
            .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
            .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
            .leftJoin(eventMembers, eq(eventMembers.id, reviews.reviewerId))
            .leftJoin(users, eq(users.id, eventMembers.userId))
            .where(eq(submissions.eventId, eventId))
            .orderBy(desc(submissions.createdAt), asc(tracks.position), asc(reviews.createdAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeMany(DashboardSubmissionRow, "dashboard submission", rows),
          ),
          Effect.map((rows) => {
            const grouped = new Map<
              string,
              DashboardSubmission & { readonly trackNames: Array<string> }
            >();

            for (const row of rows) {
              const existing = grouped.get(row.submissionId);
              if (existing !== undefined) {
                if (row.trackName !== null && !existing.trackNames.includes(row.trackName)) {
                  existing.trackNames.push(row.trackName);
                }
                continue;
              }

              const trackNames = row.trackName === null ? [] : [row.trackName];
              grouped.set(row.submissionId, {
                id: row.submissionId,
                code: row.code,
                title: row.title,
                kind: row.kind,
                status: row.status,
                track: row.trackName,
                reviewer:
                  row.reviewerName === null
                    ? null
                    : { name: row.reviewerName, image: row.reviewerImage },
                trackNames,
              });
            }

            return Array.from(grouped.values())
              .slice(0, 20)
              .map(({ trackNames, ...submission }) => ({
                ...submission,
                track: trackNames.length === 0 ? null : trackNames.join(", "),
              }));
          }),
        ),
      loadDashboard: (session, eventSlug) =>
        query(database, "Could not load dashboard", (db) =>
          db
            .select({
              submissionId: submissions.id,
              code: submissions.code,
              title: submissions.title,
              kind: submissions.kind,
              status: submissions.status,
              createdAt: submissions.createdAt,
              trackName: tracks.name,
              reviewerName: users.name,
              reviewerImage: users.image,
              speakers: dashboardContactCounts.speakers,
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
              staffMember,
              and(
                eq(staffMember.eventId, events.id),
                eq(staffMember.userId, session.userId),
                inArray(staffMember.role, ["admin", "reviewer"]),
              ),
            )
            .leftJoin(dashboardContactCounts, eq(dashboardContactCounts.eventId, events.id))
            .leftJoin(submissions, eq(submissions.eventId, events.id))
            .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
            .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
            .leftJoin(reviewerMember, eq(reviewerMember.id, reviews.reviewerId))
            .leftJoin(users, eq(users.id, reviewerMember.userId))
            .where(
              and(
                eq(events.slug, eventSlug),
                session.activeOrganizationId === undefined
                  ? undefined
                  : eq(events.organizationId, session.activeOrganizationId),
              ),
            )
            .orderBy(desc(submissions.createdAt), asc(tracks.position), asc(reviews.createdAt))
            .execute(),
        ).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
          Effect.flatMap((rows) => {
            const submissionRows = rows.flatMap((row) =>
              row.submissionId === null ||
              row.code === null ||
              row.title === null ||
              row.kind === null ||
              row.status === null ||
              row.createdAt === null
                ? []
                : [
                    {
                      submissionId: row.submissionId,
                      code: row.code,
                      title: row.title,
                      kind: row.kind,
                      status: row.status,
                      createdAt: row.createdAt,
                      trackName: row.trackName,
                      reviewerName: row.reviewerName,
                      reviewerImage: row.reviewerImage,
                    },
                  ],
            );
            return decodeMany(DashboardSubmissionRow, "dashboard submission", submissionRows).pipe(
              Effect.map((decodedRows) => {
                const submissionsById = new Map<
                  string,
                  (typeof decodedRows)[number] & { readonly trackNames: Array<string> }
                >();
                for (const row of decodedRows) {
                  const existing = submissionsById.get(row.submissionId);
                  if (existing !== undefined) {
                    if (row.trackName !== null && !existing.trackNames.includes(row.trackName)) {
                      existing.trackNames.push(row.trackName);
                    }
                    continue;
                  }
                  submissionsById.set(row.submissionId, {
                    ...row,
                    trackNames: row.trackName === null ? [] : [row.trackName],
                  });
                }
                const unique = Array.from(submissionsById.values());
                const activity = new Map<string, { abstracts: number; sessions: number }>();
                for (const submission of unique) {
                  const date = submission.createdAt.toISOString().slice(0, 10);
                  const point = activity.get(date) ?? { abstracts: 0, sessions: 0 };
                  if (submission.kind === "abstract") point.abstracts += 1;
                  else point.sessions += 1;
                  activity.set(date, point);
                }
                return {
                  submissions: unique.length,
                  pending: unique.filter((submission) => submission.status === "pending").length,
                  accepted: unique.filter((submission) => submission.status === "accepted").length,
                  speakers: rows[0]?.speakers ?? 0,
                  activity: Array.from(activity, ([date, values]) => ({ date, ...values })).sort(
                    (left, right) => left.date.localeCompare(right.date),
                  ),
                  recentSubmissions: unique.slice(0, 20).map((submission) => ({
                    id: submission.submissionId,
                    code: submission.code,
                    title: submission.title,
                    kind: submission.kind,
                    status: submission.status,
                    track:
                      submission.trackNames.length === 0 ? null : submission.trackNames.join(", "),
                    reviewer:
                      submission.reviewerName === null
                        ? null
                        : {
                            name: submission.reviewerName,
                            image: submission.reviewerImage,
                          },
                  })),
                };
              }),
            );
          }),
        ),
      listByFormContact: (formId, contactId) =>
        query(database, "Could not list submitter submissions", (db) =>
          db
            .select()
            .from(submissions)
            .where(
              and(
                eq(submissions.sourceFormId, formId),
                eq(submissions.submitterContactId, contactId),
              ),
            )
            .orderBy(desc(submissions.updatedAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Submission, "submission", rows))),
      get: (id) =>
        query(database, "Could not load submission", (db) =>
          db.select().from(submissions).where(eq(submissions.id, id)).limit(1).execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Submission, "Submission", rows[0]))),
      allocateCode,
      create: (input) =>
        Effect.gen(function* () {
          const code = yield* allocateCode(input.eventId);
          const rows = yield* query(database, "Could not create submission", (db) =>
            db
              .insert(submissions)
              .values({ ...input, code })
              .returning()
              .execute(),
          );
          return yield* decode(Submission, "submission", rows[0]);
        }),
      saveDraft: (input, id) =>
        Effect.gen(function* () {
          if (input.sourceFormId === null || input.submitterContactId === null) {
            return yield* Effect.fail(
              new DbError({ message: "Draft identity is missing", cause: input }),
            );
          }
          const sourceFormId = input.sourceFormId;
          const submitterContactId = input.submitterContactId;
          const form = yield* loadForm(sourceFormId);
          yield* assertOpen(form);

          if (id === null) {
            const [existingRows, eventRows] = yield* Effect.all([
              query(database, "Could not count submitter submissions", (db) =>
                db
                  .select()
                  .from(submissions)
                  .where(
                    and(
                      eq(submissions.sourceFormId, sourceFormId),
                      eq(submissions.submitterContactId, submitterContactId),
                    ),
                  )
                  .execute(),
              ).pipe(Effect.flatMap((rows) => decodeMany(Submission, "submission", rows))),
              query(database, "Could not load event submission limit", (db) =>
                db.select().from(events).where(eq(events.id, input.eventId)).limit(1).execute(),
              ).pipe(Effect.flatMap((rows) => decodeFound(Event, "Event", rows[0]))),
            ]);
            const limit = form.submissionLimit ?? eventRows.defaultSubmissionLimit;
            if (existingRows.length >= limit) {
              return yield* Effect.fail(
                new SubmissionLimitReached({
                  message: `You have reached the limit of ${limit} submissions`,
                }),
              );
            }
            if (
              !form.allowMultipleDrafts &&
              existingRows.some((submission) => submission.status === "draft")
            ) {
              return yield* Effect.fail(
                new SubmissionLimitReached({ message: "Resume your existing draft to continue" }),
              );
            }
            const code = yield* allocateCode(input.eventId);
            const rows = yield* query(database, "Could not save draft", (db) =>
              db
                .insert(submissions)
                .values({ ...input, code, status: "draft" })
                .returning()
                .execute(),
            );
            return yield* decode(Submission, "submission", rows[0]);
          }

          const rows = yield* query(database, "Could not save draft", (db) =>
            db
              .update(submissions)
              .set({ ...input, status: "draft", updatedAt: new Date() })
              .where(
                and(
                  eq(submissions.id, id),
                  eq(submissions.sourceFormId, sourceFormId),
                  eq(submissions.submitterContactId, submitterContactId),
                ),
              )
              .returning()
              .execute(),
          );
          if (rows.length === 0) {
            return yield* Effect.fail(
              new Forbidden({ message: "You cannot edit this submission" }),
            );
          }
          return yield* decode(Submission, "submission", rows[0]);
        }),
      submitDraft: (id, contactId) =>
        Effect.gen(function* () {
          const submission = yield* query(database, "Could not load draft", (db) =>
            db.select().from(submissions).where(eq(submissions.id, id)).limit(1).execute(),
          ).pipe(Effect.flatMap((rows) => decodeFound(Submission, "Submission", rows[0])));
          if (submission.submitterContactId !== contactId || submission.sourceFormId === null) {
            return yield* Effect.fail(new Forbidden({ message: "You cannot submit this draft" }));
          }
          const form = yield* loadForm(submission.sourceFormId);
          yield* assertOpen(form);
          const rows = yield* query(database, "Could not submit draft", (db) =>
            db
              .update(submissions)
              .set({ status: "pending", submittedAt: new Date(), updatedAt: new Date() })
              .where(eq(submissions.id, id))
              .returning()
              .execute(),
          );
          return yield* decodeFound(Submission, "Submission", rows[0]);
        }),
      update: (id, input) =>
        query(database, "Could not update submission", (db) =>
          db
            .update(submissions)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(submissions.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Submission, "Submission", rows[0]))),
      changeStatus: (id, status, notifiedAt) =>
        query(database, "Could not change submission status", (db) =>
          db
            .update(submissions)
            .set({
              status,
              ...(notifiedAt === undefined ? {} : { notifiedAt }),
              updatedAt: new Date(),
            })
            .where(eq(submissions.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Submission, "Submission", rows[0]))),
      replaceTrackIds: (submissionId, trackIds) =>
        Effect.gen(function* () {
          yield* query(database, "Could not replace submission tracks", (db) =>
            db
              .delete(submissionTracks)
              .where(eq(submissionTracks.submissionId, submissionId))
              .execute(),
          );
          if (trackIds.length === 0) return [];
          const rows = yield* query(database, "Could not replace submission tracks", (db) =>
            db
              .insert(submissionTracks)
              .values(trackIds.map((trackId) => ({ submissionId, trackId })))
              .returning()
              .execute(),
          );
          return yield* decodeMany(SubmissionTrack, "submission track", rows);
        }),
      replaceTagIds: (submissionId, tagIds) =>
        Effect.gen(function* () {
          yield* query(database, "Could not replace submission tags", (db) =>
            db
              .delete(submissionTags)
              .where(eq(submissionTags.submissionId, submissionId))
              .execute(),
          );
          if (tagIds.length === 0) return [];
          const rows = yield* query(database, "Could not replace submission tags", (db) =>
            db
              .insert(submissionTags)
              .values(tagIds.map((tagId) => ({ submissionId, tagId })))
              .returning()
              .execute(),
          );
          return yield* decodeMany(SubmissionTag, "submission tag", rows);
        }),
      replaceParticipants: (submissionId, participants) =>
        Effect.gen(function* () {
          yield* query(database, "Could not replace submission participants", (db) =>
            db
              .delete(submissionParticipants)
              .where(eq(submissionParticipants.submissionId, submissionId))
              .execute(),
          );

          if (participants.length === 0) {
            return [];
          }

          const rows = yield* query(database, "Could not replace submission participants", (db) =>
            db
              .insert(submissionParticipants)
              .values(participants.map((participant) => ({ ...participant, submissionId })))
              .returning()
              .execute(),
          );
          return yield* decodeMany(SubmissionParticipant, "submission participant", rows);
        }),
      listParticipants: (submissionId) =>
        query(database, "Could not list submission participants", (db) =>
          db
            .select()
            .from(submissionParticipants)
            .where(eq(submissionParticipants.submissionId, submissionId))
            .orderBy(asc(submissionParticipants.position))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeMany(SubmissionParticipant, "submission participant", rows),
          ),
        ),
      listTrackIds: (submissionId) =>
        query(database, "Could not list submission tracks", (db) =>
          db
            .select({ id: submissionTracks.trackId })
            .from(submissionTracks)
            .where(eq(submissionTracks.submissionId, submissionId))
            .execute(),
        ).pipe(Effect.map((rows) => rows.map((row) => row.id))),
      listTagIds: (submissionId) =>
        query(database, "Could not list submission tags", (db) =>
          db
            .select({ id: submissionTags.tagId })
            .from(submissionTags)
            .where(eq(submissionTags.submissionId, submissionId))
            .execute(),
        ).pipe(Effect.map((rows) => rows.map((row) => row.id))),
    };
  }),
);
