import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  aiReviewResults,
  contacts,
  reviewAnswers,
  reviewAssignments,
  reviewCriteria,
  reviewerTracks,
  reviewRoundMembers,
  reviewRounds,
  reviews,
  submissionParticipants,
  submissions,
  submissionTracks,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import {
  AlreadyRecused,
  AssignmentCapExceeded,
  type DbError,
  type DropdownValueNotInOptions,
  Forbidden,
  type NotFound,
  type NumericOutOfBounds,
  RoundClosed,
} from "../errors";
import {
  AiReviewResult,
  ensureRoundOpen,
  planAutoDistribution,
  type ReviewAnswerInput,
  ReviewAssignment,
  ReviewCriterion,
  type ReviewCriterionSave,
  ReviewProgress,
  ReviewResult,
  ReviewRound,
  type ReviewRoundConfiguration,
  ReviewRoundMember,
  type ReviewRoundSave,
  ReviewerQueueItem,
  validateReviewAnswer,
  weightedAggregate,
} from "../schema/reviews";
import { Review, type ReviewUpsert, Submission } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

type ReviewValidationError = NumericOutOfBounds | DropdownValueNotInOptions;

interface ReviewsService {
  readonly listBySubmission: (
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<Review>, DbError>;
  readonly listQueue: (reviewerId: string) => Effect.Effect<ReadonlyArray<Submission>, DbError>;
  readonly upsert: (input: ReviewUpsert) => Effect.Effect<Review, DbError>;
  readonly listRounds: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<ReviewRoundConfiguration>, DbError>;
  readonly reviewerQueue: (
    roundId: string,
    eventMemberId: string,
  ) => Effect.Effect<ReadonlyArray<ReviewerQueueItem>, DbError>;
  readonly progress: (roundId: string) => Effect.Effect<ReviewProgress, DbError>;
  readonly results: (roundId: string) => Effect.Effect<ReadonlyArray<ReviewResult>, DbError>;
  readonly saveRound: (input: ReviewRoundSave) => Effect.Effect<ReviewRound, DbError | NotFound>;
  readonly saveCriteria: (
    roundId: string,
    criteria: ReadonlyArray<ReviewCriterionSave>,
  ) => Effect.Effect<ReadonlyArray<ReviewCriterion>, DbError>;
  readonly addMember: (
    roundId: string,
    eventMemberId: string,
    assignmentCap: number | null,
  ) => Effect.Effect<ReviewRoundMember, DbError>;
  readonly assign: (
    roundId: string,
    submissionId: string,
    eventMemberId: string,
  ) => Effect.Effect<ReviewAssignment, DbError | NotFound | RoundClosed | AssignmentCapExceeded>;
  readonly autoDistribute: (
    roundId: string,
    trackIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<ReviewAssignment>, DbError | NotFound | RoundClosed>;
  readonly submitAnswers: (
    assignmentId: string,
    eventMemberId: string,
    answers: ReadonlyArray<ReviewAnswerInput>,
  ) => Effect.Effect<
    ReviewAssignment,
    DbError | NotFound | Forbidden | RoundClosed | ReviewValidationError
  >;
  readonly recuse: (
    assignmentId: string,
    eventMemberId: string,
    reason: string,
  ) => Effect.Effect<ReviewAssignment, DbError | NotFound | Forbidden | AlreadyRecused>;
  readonly saveAiResult: (input: {
    readonly roundId: string;
    readonly submissionId: string;
    readonly score: number;
    readonly reasoning: string;
    readonly provider: string;
    readonly model: string;
  }) => Effect.Effect<AiReviewResult, DbError>;
  readonly overrideAiResult: (
    id: string,
    score: number,
    reason: string,
    eventMemberId: string,
  ) => Effect.Effect<AiReviewResult, DbError | NotFound>;
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
      listRounds: (eventId) =>
        Effect.all(
          [
            query(database, "Could not list review rounds", (db) =>
              db
                .select()
                .from(reviewRounds)
                .where(eq(reviewRounds.eventId, eventId))
                .orderBy(asc(reviewRounds.position))
                .execute(),
            ),
            query(database, "Could not list review criteria", (db) =>
              db
                .select({ criterion: reviewCriteria })
                .from(reviewCriteria)
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewCriteria.roundId))
                .where(eq(reviewRounds.eventId, eventId))
                .orderBy(asc(reviewCriteria.position))
                .execute(),
            ),
            query(database, "Could not list review members", (db) =>
              db
                .select({ member: reviewRoundMembers })
                .from(reviewRoundMembers)
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewRoundMembers.roundId))
                .where(eq(reviewRounds.eventId, eventId))
                .orderBy(asc(reviewRoundMembers.createdAt))
                .execute(),
            ),
          ],
          { concurrency: 3 },
        ).pipe(
          Effect.flatMap(([roundRows, criterionRows, memberRows]) =>
            Effect.gen(function* () {
              const [decodedRounds, decodedCriteria, decodedMembers] = yield* Effect.all([
                decodeMany(ReviewRound, "review round", roundRows),
                decodeMany(
                  ReviewCriterion,
                  "review criterion",
                  criterionRows.map((row) => row.criterion),
                ),
                decodeMany(
                  ReviewRoundMember,
                  "review round member",
                  memberRows.map((row) => row.member),
                ),
              ]);
              return decodedRounds.map((round) => ({
                round,
                criteria: decodedCriteria.filter((criterion) => criterion.roundId === round.id),
                members: decodedMembers.filter((member) => member.roundId === round.id),
              }));
            }),
          ),
        ),
      reviewerQueue: (roundId, eventMemberId) =>
        query(database, "Could not load reviewer queue", (db) =>
          db
            .select({
              assignment: reviewAssignments,
              submission: submissions,
              trackName: tracks.name,
              answer: reviewAnswers,
            })
            .from(reviewAssignments)
            .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
            .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
            .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
            .leftJoin(reviewAnswers, eq(reviewAnswers.assignmentId, reviewAssignments.id))
            .where(
              and(
                eq(reviewAssignments.roundId, roundId),
                eq(reviewAssignments.eventMemberId, eventMemberId),
              ),
            )
            .orderBy(asc(reviewAssignments.assignedAt), asc(tracks.position))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.forEach(
              Array.from(new Set(rows.map((row) => row.assignment.id))),
              (assignmentId) => {
                const group = rows.filter((row) => row.assignment.id === assignmentId);
                const first = group[0];
                return decode(
                  ReviewerQueueItem,
                  "reviewer queue item",
                  first === undefined
                    ? undefined
                    : {
                        assignment: first.assignment,
                        code: first.submission.code,
                        title: first.submission.title,
                        description: first.submission.description,
                        status: first.submission.status,
                        trackNames: Array.from(
                          new Set(
                            group.flatMap((row) => (row.trackName === null ? [] : [row.trackName])),
                          ),
                        ),
                        answers: Array.from(
                          new Map(
                            group.flatMap((row) =>
                              row.answer === null ? [] : [[row.answer.id, row.answer]],
                            ),
                          ).values(),
                        ),
                      },
                );
              },
            ),
          ),
        ),
      progress: (roundId) =>
        query(database, "Could not load review progress", (db) =>
          db
            .select({ status: reviewAssignments.status })
            .from(reviewAssignments)
            .where(eq(reviewAssignments.roundId, roundId))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => {
            const completed = rows.filter((row) => row.status === "completed").length;
            const recused = rows.filter((row) => row.status === "recused").length;
            return decode(ReviewProgress, "review progress", {
              roundId,
              total: rows.length,
              completed,
              recused,
              required: rows.length - recused,
            });
          }),
        ),
      results: (roundId) =>
        query(database, "Could not load review results", (db) =>
          db
            .select({
              assignment: reviewAssignments,
              submission: submissions,
              answer: reviewAnswers,
              criterion: reviewCriteria,
              participant: submissionParticipants,
              contact: contacts,
              aiResult: aiReviewResults,
            })
            .from(reviewAssignments)
            .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
            .leftJoin(reviewAnswers, eq(reviewAnswers.assignmentId, reviewAssignments.id))
            .leftJoin(reviewCriteria, eq(reviewCriteria.id, reviewAnswers.criterionId))
            .leftJoin(
              submissionParticipants,
              eq(submissionParticipants.submissionId, submissions.id),
            )
            .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
            .leftJoin(
              aiReviewResults,
              and(
                eq(aiReviewResults.roundId, roundId),
                eq(aiReviewResults.submissionId, submissions.id),
              ),
            )
            .where(eq(reviewAssignments.roundId, roundId))
            .orderBy(asc(submissions.code))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.forEach(
              Array.from(new Set(rows.map((row) => row.submission.id))),
              (submissionId) => {
                const group = rows.filter((row) => row.submission.id === submissionId);
                const first = group[0];
                const numeric = Array.from(
                  new Map(
                    group.flatMap((row) =>
                      row.answer?.numericValue === null ||
                      row.answer?.numericValue === undefined ||
                      row.criterion === null
                        ? []
                        : [
                            [
                              row.answer.id,
                              { value: row.answer.numericValue, weight: row.criterion.weight },
                            ],
                          ],
                    ),
                  ).values(),
                );
                return decode(
                  ReviewResult,
                  "review result",
                  first === undefined
                    ? undefined
                    : {
                        submissionId,
                        code: first.submission.code,
                        title: first.submission.title,
                        speakerNames: Array.from(
                          new Set(
                            group.flatMap((row) =>
                              row.contact === null
                                ? []
                                : [`${row.contact.firstName} ${row.contact.lastName}`],
                            ),
                          ),
                        ),
                        reviewerCount: new Set(group.map((row) => row.assignment.eventMemberId))
                          .size,
                        completedCount: new Set(
                          group.flatMap((row) =>
                            row.assignment.status === "completed" ? [row.assignment.id] : [],
                          ),
                        ).size,
                        weightedAggregate: weightedAggregate(numeric),
                        aiResult: first.aiResult,
                      },
                );
              },
            ),
          ),
        ),
      saveRound: (input) => {
        const { id: roundId, ...values } = input;
        return roundId === null
          ? query(database, "Could not create review round", (db) =>
              db.insert(reviewRounds).values(values).returning().execute(),
            ).pipe(Effect.flatMap((rows) => decode(ReviewRound, "review round", rows[0])))
          : query(database, "Could not update review round", (db) =>
              db
                .update(reviewRounds)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(reviewRounds.id, roundId))
                .returning()
                .execute(),
            ).pipe(Effect.flatMap((rows) => decodeFound(ReviewRound, "Review round", rows[0])));
      },
      saveCriteria: (roundId, criteria) =>
        query(database, "Could not save review criteria", (db) =>
          db.transaction(async (transaction) => {
            await transaction
              .delete(reviewCriteria)
              .where(eq(reviewCriteria.roundId, roundId))
              .execute();
            if (criteria.length === 0) return [];
            return await transaction
              .insert(reviewCriteria)
              .values(criteria.map(({ id: _id, ...criterion }) => ({ ...criterion, roundId })))
              .returning()
              .execute();
          }),
        ).pipe(Effect.flatMap((rows) => decodeMany(ReviewCriterion, "review criterion", rows))),
      addMember: (roundId, eventMemberId, assignmentCap) =>
        query(database, "Could not add review member", (db) =>
          db
            .insert(reviewRoundMembers)
            .values({ roundId, eventMemberId, assignmentCap })
            .onConflictDoUpdate({
              target: [reviewRoundMembers.roundId, reviewRoundMembers.eventMemberId],
              set: { assignmentCap, updatedAt: new Date() },
            })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(ReviewRoundMember, "review round member", rows[0]))),
      assign: (roundId, submissionId, eventMemberId) =>
        query(database, "Could not assign review", (db) =>
          db.transaction(async (transaction) => {
            const [round] = await transaction
              .select()
              .from(reviewRounds)
              .where(eq(reviewRounds.id, roundId))
              .limit(1)
              .execute();
            if (round === undefined) return { kind: "notFound" as const };
            if (ensureRoundOpen(round, new Date()) !== undefined)
              return { kind: "closed" as const };
            const [member] = await transaction
              .select()
              .from(reviewRoundMembers)
              .where(
                and(
                  eq(reviewRoundMembers.roundId, roundId),
                  eq(reviewRoundMembers.eventMemberId, eventMemberId),
                ),
              )
              .limit(1)
              .execute();
            const [submission] = await transaction
              .select({ id: submissions.id })
              .from(submissions)
              .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, round.eventId)))
              .limit(1)
              .execute();
            if (member === undefined || submission === undefined)
              return { kind: "notFound" as const };
            const current = await transaction
              .select({ status: reviewAssignments.status })
              .from(reviewAssignments)
              .where(
                and(
                  eq(reviewAssignments.roundId, roundId),
                  eq(reviewAssignments.eventMemberId, eventMemberId),
                ),
              )
              .execute();
            if (
              member.assignmentCap !== null &&
              current.filter((assignment) => assignment.status !== "recused").length >=
                member.assignmentCap
            )
              return { kind: "cap" as const };
            const [created] = await transaction
              .insert(reviewAssignments)
              .values({ roundId, submissionId, eventMemberId, assignedAt: new Date() })
              .onConflictDoNothing()
              .returning()
              .execute();
            if (created !== undefined) return { kind: "ok" as const, row: created };
            const [existing] = await transaction
              .select()
              .from(reviewAssignments)
              .where(
                and(
                  eq(reviewAssignments.roundId, roundId),
                  eq(reviewAssignments.submissionId, submissionId),
                  eq(reviewAssignments.eventMemberId, eventMemberId),
                ),
              )
              .limit(1)
              .execute();
            return existing === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: existing };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              ReviewAssignment,
              DbError | NotFound | RoundClosed | AssignmentCapExceeded
            > => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignment, "Review assignment", undefined);
              if (outcome.kind === "closed")
                return Effect.fail(new RoundClosed({ message: "This review round is closed" }));
              if (outcome.kind === "cap")
                return Effect.fail(
                  new AssignmentCapExceeded({
                    message: "This reviewer has reached their assignment cap",
                  }),
                );
              return decode(ReviewAssignment, "review assignment", outcome.row);
            },
          ),
        ),
      autoDistribute: (roundId, trackIds) =>
        query(database, "Could not auto-distribute reviews", (db) =>
          db.transaction(async (transaction) => {
            const [round] = await transaction
              .select()
              .from(reviewRounds)
              .where(eq(reviewRounds.id, roundId))
              .limit(1)
              .execute();
            if (round === undefined) return { kind: "notFound" as const };
            if (ensureRoundOpen(round, new Date()) !== undefined)
              return { kind: "closed" as const };
            const [members, existing, candidates, candidateTracks] = await Promise.all([
              transaction
                .select()
                .from(reviewRoundMembers)
                .where(eq(reviewRoundMembers.roundId, roundId))
                .execute(),
              transaction
                .select()
                .from(reviewAssignments)
                .where(eq(reviewAssignments.roundId, roundId))
                .execute(),
              transaction
                .select({ id: submissions.id })
                .from(submissions)
                .where(
                  and(eq(submissions.eventId, round.eventId), eq(submissions.status, "pending")),
                )
                .execute(),
              trackIds.length === 0
                ? Promise.resolve([])
                : transaction
                    .select({ submissionId: submissionTracks.submissionId })
                    .from(submissionTracks)
                    .where(inArray(submissionTracks.trackId, trackIds))
                    .execute(),
            ]);
            const allowed = new Set(candidateTracks.map((row) => row.submissionId));
            const planned = planAutoDistribution({
              submissionIds: candidates.flatMap((candidate) =>
                trackIds.length === 0 || allowed.has(candidate.id) ? [candidate.id] : [],
              ),
              members: members.map((member) => ({
                eventMemberId: member.eventMemberId,
                assignmentCap: member.assignmentCap,
              })),
              existing: existing.map((assignment) => ({
                submissionId: assignment.submissionId,
                eventMemberId: assignment.eventMemberId,
              })),
            });
            if (planned.length === 0) return { kind: "ok" as const, rows: [] };
            const created = await transaction
              .insert(reviewAssignments)
              .values(planned.map((item) => ({ ...item, roundId, assignedAt: new Date() })))
              .onConflictDoNothing()
              .returning()
              .execute();
            return { kind: "ok" as const, rows: created };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<ReadonlyArray<ReviewAssignment>, DbError | NotFound | RoundClosed> => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignment, "Review round", undefined).pipe(
                  Effect.map((assignment) => [assignment]),
                );
              if (outcome.kind === "closed")
                return Effect.fail(new RoundClosed({ message: "This review round is closed" }));
              return decodeMany(ReviewAssignment, "review assignment", outcome.rows);
            },
          ),
        ),
      submitAnswers: (assignmentId, eventMemberId, answers) =>
        query(database, "Could not submit review answers", (db) =>
          db.transaction(async (transaction) => {
            const [assignment] = await transaction
              .select()
              .from(reviewAssignments)
              .where(eq(reviewAssignments.id, assignmentId))
              .limit(1)
              .execute();
            if (assignment === undefined) return { kind: "notFound" as const };
            if (assignment.eventMemberId !== eventMemberId) return { kind: "forbidden" as const };
            const [round] = await transaction
              .select()
              .from(reviewRounds)
              .where(eq(reviewRounds.id, assignment.roundId))
              .limit(1)
              .execute();
            if (round === undefined) return { kind: "notFound" as const };
            if (ensureRoundOpen(round, new Date()) !== undefined)
              return { kind: "closed" as const };
            const criteria = await transaction
              .select()
              .from(reviewCriteria)
              .where(eq(reviewCriteria.roundId, round.id))
              .execute();
            for (const answer of answers) {
              const criterion = criteria.find((item) => item.id === answer.criterionId);
              if (criterion === undefined) return { kind: "forbidden" as const };
              const validation = validateReviewAnswer(criterion, answer);
              if (validation !== undefined) return { kind: "invalid" as const, error: validation };
            }
            await transaction
              .delete(reviewAnswers)
              .where(eq(reviewAnswers.assignmentId, assignmentId))
              .execute();
            if (answers.length > 0)
              await transaction
                .insert(reviewAnswers)
                .values(answers.map((answer) => ({ ...answer, assignmentId })))
                .execute();
            const now = new Date();
            const [saved] = await transaction
              .update(reviewAssignments)
              .set({ status: "completed", completedAt: now, updatedAt: now })
              .where(eq(reviewAssignments.id, assignmentId))
              .returning()
              .execute();
            return saved === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: saved };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              ReviewAssignment,
              DbError | NotFound | Forbidden | RoundClosed | ReviewValidationError
            > => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignment, "Review assignment", undefined);
              if (outcome.kind === "forbidden")
                return Effect.fail(new Forbidden({ message: "You cannot submit this review" }));
              if (outcome.kind === "closed")
                return Effect.fail(new RoundClosed({ message: "This review round is closed" }));
              if (outcome.kind === "invalid") return Effect.fail(outcome.error);
              return decode(ReviewAssignment, "review assignment", outcome.row);
            },
          ),
        ),
      recuse: (assignmentId, eventMemberId, reason) =>
        query(database, "Could not recuse review", (db) =>
          db.transaction(async (transaction) => {
            const [assignment] = await transaction
              .select()
              .from(reviewAssignments)
              .where(eq(reviewAssignments.id, assignmentId))
              .limit(1)
              .execute();
            if (assignment === undefined) return { kind: "notFound" as const };
            if (assignment.eventMemberId !== eventMemberId) return { kind: "forbidden" as const };
            if (assignment.status === "recused") return { kind: "recused" as const };
            const now = new Date();
            const [saved] = await transaction
              .update(reviewAssignments)
              .set({
                status: "recused",
                recusedAt: now,
                recusalReason: reason,
                completedAt: null,
                updatedAt: now,
              })
              .where(eq(reviewAssignments.id, assignmentId))
              .returning()
              .execute();
            return saved === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: saved };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<ReviewAssignment, DbError | NotFound | Forbidden | AlreadyRecused> => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignment, "Review assignment", undefined);
              if (outcome.kind === "forbidden")
                return Effect.fail(new Forbidden({ message: "You cannot recuse this review" }));
              if (outcome.kind === "recused")
                return Effect.fail(
                  new AlreadyRecused({ message: "This assignment is already recused" }),
                );
              return decode(ReviewAssignment, "review assignment", outcome.row);
            },
          ),
        ),
      saveAiResult: (input) =>
        query(database, "Could not save AI review", (db) =>
          db
            .insert(aiReviewResults)
            .values(input)
            .onConflictDoUpdate({
              target: [aiReviewResults.roundId, aiReviewResults.submissionId],
              set: {
                score: input.score,
                reasoning: input.reasoning,
                provider: input.provider,
                model: input.model,
                updatedAt: new Date(),
              },
            })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(AiReviewResult, "AI review result", rows[0]))),
      overrideAiResult: (id, score, reason, eventMemberId) =>
        query(database, "Could not override AI review", (db) =>
          db
            .update(aiReviewResults)
            .set({
              overriddenScore: score,
              overrideReason: reason,
              overriddenByEventMemberId: eventMemberId,
              overriddenAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(aiReviewResults.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(AiReviewResult, "AI review result", rows[0]))),
    };
  }),
);
