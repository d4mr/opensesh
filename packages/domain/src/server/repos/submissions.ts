import { asc, desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  eventMembers,
  reviews,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tracks,
  users,
} from "../../db/schema";
import { Db } from "../db";
import type { DbError, FormClosed, NotFound, SubmissionLimitReached } from "../errors";
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
  readonly get: (id: string) => Effect.Effect<Submission, DbError | NotFound>;
  readonly allocateCode: (eventId: string) => Effect.Effect<string, DbError>;
  readonly create: (
    input: SubmissionCreate,
  ) => Effect.Effect<Submission, DbError | FormClosed | SubmissionLimitReached>;
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
}

export class Submissions extends Context.Service<Submissions, SubmissionsService>()(
  "opensesh/Submissions",
) {}

export const SubmissionsLive = Layer.effect(
  Submissions,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const allocateCode = (eventId: string) =>
      query(database, "Could not allocate a submission code", (db) =>
        db
          .select({
            next: sql<number>`coalesce(max(cast(substr(${submissions.code}, 6) as integer)), 0) + 1`,
          })
          .from(submissions)
          .where(eq(submissions.eventId, eventId))
          .execute(),
      ).pipe(Effect.map((rows) => `SESS-${rows[0]?.next ?? 1}`));

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
    };
  }),
);
