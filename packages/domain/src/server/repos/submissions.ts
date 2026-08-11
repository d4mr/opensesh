import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer } from "effect";

import {
  contacts,
  embeds,
  eventMembers,
  events,
  fileUploads,
  formats,
  forms,
  organizationMembers,
  reviewRounds,
  reviews,
  sessionFileRequirementAssignments,
  sessionFileRequirements,
  rooms,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  taskAssignments,
  taskTemplates,
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
  readonly eventSlug: string;
  readonly submissions: number;
  readonly drafts: number;
  readonly pending: number;
  readonly maybe: number;
  readonly accepted: number;
  readonly declined: number;
  readonly speakers: number;
  /** Submitted (non-draft) submissions with at least one review. */
  readonly reviewed: number;
  readonly submitted: number;
  /** Non-draft, non-withdrawn proposals (abstracts) — the review denominator. */
  readonly reviewEligible: number;
  /** Of reviewEligible: reviewed, or already decided (accepted/declined). */
  readonly reviewedEligible: number;
  /** Whether the public agenda has been published. */
  readonly agendaPublished: boolean;
  readonly scheduled: number;
  readonly acceptedUnscheduled: number;
  /** Overlapping accepted sessions sharing a room. */
  readonly conflicts: number;
  readonly cfpCloseDate: Date | null;
  /** Counts that derive the program-lifecycle guide on Overview. */
  readonly lifecycle: {
    readonly tracks: number;
    readonly formats: number;
    readonly rooms: number;
    readonly forms: number;
    readonly openForms: number;
    readonly rounds: number;
    readonly widgets: number;
    readonly tasksTotal: number;
    readonly tasksComplete: number;
    readonly notified: number;
  };
  readonly agendaDays: ReadonlyArray<{
    readonly date: string;
    readonly sessions: number;
    readonly rooms: number;
  }>;
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
      .where(eq(contacts.participation, "speaker"))
      .groupBy(contacts.eventId)
      .as("dashboard_contact_counts");
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
        Effect.all(
          [
            query(database, "Could not load dashboard", (db) =>
              db
                .select({
                  submissionId: submissions.id,
                  code: submissions.code,
                  title: submissions.title,
                  kind: submissions.kind,
                  status: submissions.status,
                  createdAt: submissions.createdAt,
                  startsAt: submissions.startsAt,
                  endsAt: submissions.endsAt,
                  roomId: submissions.roomId,
                  reviewId: reviews.id,
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
            ),
            query(database, "Could not load dashboard forms", (db) =>
              db
                .select({ closeDate: forms.closeDate, status: forms.status })
                .from(forms)
                .innerJoin(events, eq(forms.eventId, events.id))
                .where(eq(events.slug, eventSlug))
                .execute(),
            ),
            query(database, "Could not load dashboard lifecycle", async (db) => {
              const [event] = await db
                .select({ id: events.id, agendaPublishedAt: events.agendaPublishedAt })
                .from(events)
                .where(eq(events.slug, eventSlug))
                .limit(1)
                .execute();
              const empty = {
                tracks: 0,
                formats: 0,
                rooms: 0,
                rounds: 0,
                widgets: 0,
                tasksTotal: 0,
                tasksComplete: 0,
                notified: 0,
                agendaPublished: false,
              };
              if (event === undefined) return empty;
              const value = async (promise: Promise<ReadonlyArray<{ value: number }>>) =>
                Number((await promise)[0]?.value ?? 0);
              const [
                trackCount,
                formatCount,
                roomCount,
                roundCount,
                widgetCount,
                taskTotals,
                notifiedCount,
              ] = await Promise.all([
                value(
                  db
                    .select({ value: count() })
                    .from(tracks)
                    .where(eq(tracks.eventId, event.id))
                    .execute(),
                ),
                value(
                  db
                    .select({ value: count() })
                    .from(formats)
                    .where(eq(formats.eventId, event.id))
                    .execute(),
                ),
                value(
                  db
                    .select({ value: count() })
                    .from(rooms)
                    .where(eq(rooms.eventId, event.id))
                    .execute(),
                ),
                value(
                  db
                    .select({ value: count() })
                    .from(reviewRounds)
                    .where(eq(reviewRounds.eventId, event.id))
                    .execute(),
                ),
                value(
                  db
                    .select({ value: count() })
                    .from(embeds)
                    .where(eq(embeds.eventId, event.id))
                    .execute(),
                ),
                db
                  .select({
                    total: count(),
                    complete: count(taskAssignments.completedAt),
                  })
                  .from(taskAssignments)
                  .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                  .where(eq(taskTemplates.eventId, event.id))
                  .execute(),
                value(
                  db
                    .select({ value: count() })
                    .from(submissions)
                    .where(
                      and(eq(submissions.eventId, event.id), isNotNull(submissions.notifiedAt)),
                    )
                    .execute(),
                ),
              ]);
              return {
                tracks: trackCount,
                formats: formatCount,
                rooms: roomCount,
                rounds: roundCount,
                widgets: widgetCount,
                tasksTotal: Number(taskTotals[0]?.total ?? 0),
                tasksComplete: Number(taskTotals[0]?.complete ?? 0),
                notified: notifiedCount,
                agendaPublished: event.agendaPublishedAt !== null,
              };
            }),
          ],
          { concurrency: "unbounded" },
        ).pipe(
          Effect.filterOrFail(
            ([rows]) => rows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
          Effect.flatMap(([rows, formRows, lifecycleCounts]) => {
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
                      startsAt: row.startsAt,
                      endsAt: row.endsAt,
                      roomId: row.roomId,
                      reviewId: row.reviewId,
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
                const reviewedIds = new Set(
                  decodedRows.filter((row) => row.reviewId !== null).map((row) => row.submissionId),
                );
                // The review denominator: proposals that actually flow through
                // evaluation. Manually created sessions never do; withdrawn
                // and draft entries left the pipeline. A decided proposal
                // counts as handled even without a recorded review.
                const eligibleRows = unique.filter(
                  (submission) =>
                    submission.kind === "abstract" &&
                    submission.status !== "draft" &&
                    submission.status !== "withdrawn",
                );
                const reviewedEligible = eligibleRows.filter(
                  (submission) =>
                    reviewedIds.has(submission.submissionId) ||
                    submission.status === "accepted" ||
                    submission.status === "declined",
                ).length;
                const count = (status: string) =>
                  unique.filter((submission) => submission.status === status).length;
                const accepted = count("accepted");
                const scheduledSessions = unique.flatMap((submission) =>
                  submission.status === "accepted" &&
                  submission.startsAt !== null &&
                  submission.endsAt !== null &&
                  submission.roomId !== null
                    ? [
                        {
                          startsAt: submission.startsAt,
                          endsAt: submission.endsAt,
                          roomId: submission.roomId,
                        },
                      ]
                    : [],
                );
                const byRoom = new Map<string, Array<{ startsAt: Date; endsAt: Date }>>();
                for (const scheduled of scheduledSessions) {
                  const list = byRoom.get(scheduled.roomId) ?? [];
                  list.push(scheduled);
                  byRoom.set(scheduled.roomId, list);
                }
                let conflicts = 0;
                for (const list of byRoom.values()) {
                  const sorted = list
                    .slice()
                    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
                  for (let index = 1; index < sorted.length; index += 1) {
                    const previous = sorted[index - 1];
                    const current = sorted[index];
                    if (
                      previous !== undefined &&
                      current !== undefined &&
                      current.startsAt < previous.endsAt
                    ) {
                      conflicts += 1;
                    }
                  }
                }
                const agendaByDay = new Map<string, { sessions: number; rooms: Set<string> }>();
                for (const scheduled of scheduledSessions) {
                  const date = scheduled.startsAt.toISOString().slice(0, 10);
                  const day = agendaByDay.get(date) ?? { sessions: 0, rooms: new Set<string>() };
                  day.sessions += 1;
                  day.rooms.add(scheduled.roomId);
                  agendaByDay.set(date, day);
                }
                const openCloseDates = formRows.flatMap((form) =>
                  form.status === "open" && form.closeDate !== null ? [form.closeDate] : [],
                );
                return {
                  eventSlug,
                  submissions: unique.length,
                  drafts: count("draft"),
                  pending: count("pending"),
                  maybe: count("maybe"),
                  accepted,
                  declined: count("declined"),
                  speakers: rows[0]?.speakers ?? 0,
                  reviewed: reviewedIds.size,
                  submitted: unique.length - count("draft"),
                  reviewEligible: eligibleRows.length,
                  reviewedEligible,
                  agendaPublished: lifecycleCounts.agendaPublished,
                  scheduled: scheduledSessions.length,
                  acceptedUnscheduled: accepted - scheduledSessions.length,
                  conflicts,
                  cfpCloseDate:
                    openCloseDates.length === 0
                      ? null
                      : (openCloseDates
                          .slice()
                          .sort((left, right) => left.getTime() - right.getTime())[0] ?? null),
                  lifecycle: {
                    tracks: lifecycleCounts.tracks,
                    formats: lifecycleCounts.formats,
                    rooms: lifecycleCounts.rooms,
                    rounds: lifecycleCounts.rounds,
                    widgets: lifecycleCounts.widgets,
                    tasksTotal: lifecycleCounts.tasksTotal,
                    tasksComplete: lifecycleCounts.tasksComplete,
                    notified: lifecycleCounts.notified,
                    forms: formRows.length,
                    openForms: formRows.filter((form) => form.status === "open").length,
                  },
                  agendaDays: Array.from(agendaByDay, ([date, day]) => ({
                    date,
                    sessions: day.sessions,
                    rooms: day.rooms.size,
                  })).sort((left, right) => left.date.localeCompare(right.date)),
                  activity: Array.from(activity, ([date, values]) => ({ date, ...values })).sort(
                    (left, right) => left.date.localeCompare(right.date),
                  ),
                  recentSubmissions: unique.slice(0, 50).map((submission) => ({
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
        Effect.gen(function* () {
          const current = yield* query(database, "Could not load submission", (db) =>
            db.select().from(submissions).where(eq(submissions.id, id)).limit(1).execute(),
          ).pipe(Effect.flatMap((rows) => decodeFound(Submission, "Submission", rows[0])));
          const approvedSnapshot = {
            title: current.title,
            description: current.description,
            formatId: current.formatId,
            levelId: current.levelId,
            language: current.language,
            answers: current.answers,
          };
          const changed = yield* query(database, "Could not change submission status", (db) =>
            db
              .update(submissions)
              .set({
                status,
                ...(status === "accepted"
                  ? { approvedSnapshot, contentReviewStatus: "approved" as const }
                  : {}),
                ...(notifiedAt === undefined ? {} : { notifiedAt }),
                updatedAt: new Date(),
              })
              .where(eq(submissions.id, id))
              .returning()
              .execute(),
          );
          return yield* decodeFound(Submission, "Submission", changed[0]);
        }),
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
          const rows = yield* query(database, "Could not replace submission participants", (db) =>
            db.transaction(async (transaction) => {
              const submissionRows = await transaction
                .select({ eventId: submissions.eventId, status: submissions.status })
                .from(submissions)
                .where(eq(submissions.id, submissionId))
                .limit(1);
              await transaction
                .delete(submissionParticipants)
                .where(eq(submissionParticipants.submissionId, submissionId));
              const inserted =
                participants.length === 0
                  ? []
                  : await transaction
                      .insert(submissionParticipants)
                      .values(participants.map((participant) => ({ ...participant, submissionId })))
                      .returning();
              const submission = submissionRows[0];
              if (submission?.status !== "accepted") return inserted;

              const [requirements, existing, uploaded] = await Promise.all([
                transaction
                  .select()
                  .from(sessionFileRequirements)
                  .where(eq(sessionFileRequirements.eventId, submission.eventId)),
                transaction
                  .select()
                  .from(sessionFileRequirementAssignments)
                  .where(eq(sessionFileRequirementAssignments.submissionId, submissionId)),
                transaction
                  .select({ assignmentId: fileUploads.assignmentId })
                  .from(fileUploads)
                  .innerJoin(
                    sessionFileRequirementAssignments,
                    eq(sessionFileRequirementAssignments.id, fileUploads.assignmentId),
                  )
                  .where(eq(sessionFileRequirementAssignments.submissionId, submissionId)),
              ]);
              const contactIds = new Set(participants.map((participant) => participant.contactId));
              const uploadedIds = new Set(uploaded.map((upload) => upload.assignmentId));
              const removableIds = existing.flatMap((assignment) =>
                assignment.contactId !== null &&
                !contactIds.has(assignment.contactId) &&
                !uploadedIds.has(assignment.id)
                  ? [assignment.id]
                  : [],
              );
              if (removableIds.length > 0) {
                await transaction
                  .delete(sessionFileRequirementAssignments)
                  .where(inArray(sessionFileRequirementAssignments.id, removableIds));
              }
              const fileAssignments: Array<typeof sessionFileRequirementAssignments.$inferInsert> =
                [];
              for (const requirement of requirements) {
                if (requirement.scope === "submission") {
                  fileAssignments.push({
                    requirementId: requirement.id,
                    submissionId,
                    contactId: null,
                    status: "outstanding",
                  });
                  continue;
                }
                for (const contactId of contactIds) {
                  fileAssignments.push({
                    requirementId: requirement.id,
                    submissionId,
                    contactId,
                    status: "outstanding",
                  });
                }
              }
              if (fileAssignments.length > 0) {
                await transaction
                  .insert(sessionFileRequirementAssignments)
                  .values(fileAssignments)
                  .onConflictDoNothing();
              }
              return inserted;
            }),
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
