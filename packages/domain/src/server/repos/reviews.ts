import { and, asc, eq, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { reviewerTracks, reviews, submissions, submissionTracks } from "../../db/schema";
import { Db } from "../db";
import type { DbError } from "../errors";
import { Review, type ReviewUpsert, Submission } from "../schema/submissions";
import { decode, decodeMany, query } from "./shared";

interface ReviewsService {
  readonly listBySubmission: (
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<Review>, DbError>;
  readonly listQueue: (reviewerId: string) => Effect.Effect<ReadonlyArray<Submission>, DbError>;
  readonly upsert: (input: ReviewUpsert) => Effect.Effect<Review, DbError>;
}

export class Reviews extends Context.Service<Reviews, ReviewsService>()("opensesh/Reviews") {}

export const ReviewsLive = Layer.effect(
  Reviews,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      listBySubmission: (submissionId) =>
        query(database, "Could not list reviews", (db) =>
          db
            .select()
            .from(reviews)
            .where(eq(reviews.submissionId, submissionId))
            .orderBy(asc(reviews.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Review, "review", rows))),
      listQueue: (reviewerId) =>
        query(database, "Could not load the review queue", (db) =>
          db
            .select({ submission: submissions })
            .from(submissions)
            .innerJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .innerJoin(reviewerTracks, eq(reviewerTracks.trackId, submissionTracks.trackId))
            .leftJoin(
              reviews,
              and(eq(reviews.submissionId, submissions.id), eq(reviews.reviewerId, reviewerId)),
            )
            .where(
              and(
                eq(reviewerTracks.eventMemberId, reviewerId),
                eq(submissions.status, "pending"),
                isNull(reviews.id),
              ),
            )
            .groupBy(submissions.id)
            .orderBy(asc(submissions.submittedAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeMany(
              Submission,
              "submission",
              rows.map((row) => row.submission),
            ),
          ),
        ),
      upsert: (input) =>
        query(database, "Could not save review", (db) =>
          db
            .insert(reviews)
            .values(input)
            .onConflictDoUpdate({
              target: [reviews.submissionId, reviews.reviewerId],
              set: {
                decision: input.decision,
                score: input.score,
                comment: input.comment,
                updatedAt: new Date(),
              },
            })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(Review, "review", rows[0]))),
    };
  }),
);
