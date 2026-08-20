import { reviewReminder, reviewerInvitation } from "@opensesh/email";
import { and, asc, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";
import { Config, Context, Effect, Layer, Option, Schema } from "effect";

import {
  aiReviewResults,
  contacts,
  emailLog,
  eventMembers,
  events,
  organizationMembers,
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
  users,
} from "../../db/schema";
import { Db } from "../db";
import {
  AlreadyRecused,
  AssignmentCapExceeded,
  type DbError,
  type DropdownValueNotInOptions,
  Forbidden,
  InvalidInput,
  NotFound,
  type NumericOutOfBounds,
  RoundClosed,
  ReviewGenerationError,
} from "../errors";
import type { AuditActor } from "../schema/common";
import {
  AiReviewResult,
  EvaluationAdminWorkspace,
  EvaluationSubmission,
  ensureRoundOpen,
  planAutoDistribution,
  ReviewAnswer,
  type ReviewAnswerInput,
  ReviewAssignment,
  ReviewAssignmentBatch,
  ReviewAssignmentMutation,
  ReviewCriterion,
  type ReviewCriterionSave,
  ReviewProgress,
  ReviewReminder,
  ReviewResult,
  ReviewRound,
  type ReviewRoundConfiguration,
  ReviewRoundMember,
  type ReviewRoundSave,
  ReviewerQueueItem,
  ReviewerProvisioned,
  ReviewerWorkspace,
  type ReviewRoundAdminView,
  redactBlindSubmission,
  validateReviewAnswer,
  validateRequiredReviewAnswer,
  weightedAggregate,
} from "../schema/reviews";
import { Review, type ReviewUpsert, Submission } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

type ReviewValidationError = NumericOutOfBounds | DropdownValueNotInOptions | InvalidInput;

interface ReviewsService {
  readonly listBySubmission: (
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<Review>, DbError>;
  readonly listQueue: (reviewerId: string) => Effect.Effect<ReadonlyArray<Submission>, DbError>;
  readonly upsert: (input: ReviewUpsert) => Effect.Effect<Review, DbError>;
  readonly listRounds: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<ReviewRoundConfiguration>, DbError>;
  readonly adminWorkspace: (eventId: string) => Effect.Effect<EvaluationAdminWorkspace, DbError>;
  readonly eventMemberId: (
    eventId: string,
    userId: string,
  ) => Effect.Effect<string, DbError | NotFound>;
  readonly reviewerWorkspace: (
    eventId: string,
    userId: string,
  ) => Effect.Effect<ReviewerWorkspace, DbError | Forbidden | NotFound>;
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
  readonly provisionMember: (input: {
    readonly roundId: string;
    readonly name: string;
    readonly email: string;
    readonly assignmentCap: number | null;
    readonly accessPath: string;
  }) => Effect.Effect<ReviewerProvisioned, DbError | NotFound>;
  readonly assign: (
    roundId: string,
    submissionId: string,
    eventMemberId: string,
  ) => Effect.Effect<
    ReviewAssignmentMutation,
    DbError | NotFound | RoundClosed | AssignmentCapExceeded
  >;
  readonly autoDistribute: (
    roundId: string,
    trackIds: ReadonlyArray<string>,
    dryRun: boolean,
  ) => Effect.Effect<ReviewAssignmentBatch, DbError | NotFound | RoundClosed>;
  readonly unassign: (
    roundId: string,
    assignmentId: string,
  ) => Effect.Effect<void, DbError | NotFound>;
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
  readonly queueReminders: (
    roundId: string,
    eventMemberIds: ReadonlyArray<string>,
    portalOrigin: string,
  ) => Effect.Effect<ReadonlyArray<ReviewReminder>, DbError | NotFound>;
  readonly generateAiResult: (
    roundId: string,
    submissionId: string,
  ) => Effect.Effect<AiReviewResult, DbError | NotFound | ReviewGenerationError>;
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
    actor: AuditActor,
  ) => Effect.Effect<AiReviewResult, DbError | NotFound>;
}

const AI_REVIEW_MODEL = "claude-sonnet-5";
const AiReviewProposal = Schema.Struct({
  score: Schema.Number,
  reasoning: Schema.String,
});
const AnthropicReviewResponse = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      name: Schema.optionalKey(Schema.String),
      input: Schema.optionalKey(Schema.Unknown),
    }),
  ),
});
const requestAiReview = (input: {
  readonly apiKey: string;
  readonly title: string;
  readonly description: string;
  readonly criteria: ReadonlyArray<ReviewCriterion>;
}) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "x-api-key": input.apiKey,
          },
          body: JSON.stringify({
            model: AI_REVIEW_MODEL,
            max_tokens: 1_024,
            temperature: 0.1,
            system:
              "Evaluate the conference proposal against the supplied scorecard. Return an overall numeric score and concise written reasoning grounded only in the proposal.",
            messages: [
              {
                role: "user",
                content: JSON.stringify({
                  proposal: { title: input.title, description: input.description },
                  criteria: input.criteria.map((criterion) => ({
                    label: criterion.label,
                    type: criterion.type,
                    min: criterion.min,
                    max: criterion.max,
                    options: criterion.options,
                    weight: criterion.weight,
                  })),
                }),
              },
            ],
            tools: [
              {
                name: "submit_abstract_review",
                description: "Return the abstract review.",
                input_schema: Schema.toJsonSchemaDocument(AiReviewProposal).schema,
              },
            ],
            tool_choice: { type: "tool", name: "submit_abstract_review" },
          }),
        }),
      catch: (cause) =>
        new ReviewGenerationError({ message: "Claude could not evaluate this proposal", cause }),
    });
    const responseText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) =>
        new ReviewGenerationError({ message: "Claude returned an unreadable response", cause }),
    });
    if (!response.ok) {
      return yield* Effect.fail(
        new ReviewGenerationError({
          message: `Claude could not evaluate this proposal (${response.status})`,
          cause: responseText,
        }),
      );
    }
    const decoded = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(AnthropicReviewResponse),
    )(responseText).pipe(
      Effect.mapError(
        (cause) =>
          new ReviewGenerationError({ message: "Claude returned an invalid response", cause }),
      ),
    );
    const toolUse = decoded.content.find(
      (content) => content.type === "tool_use" && content.name === "submit_abstract_review",
    );
    if (toolUse?.input === undefined) {
      return yield* Effect.fail(
        new ReviewGenerationError({
          message: "Claude did not return an abstract review",
          cause: decoded,
        }),
      );
    }
    return yield* Schema.decodeUnknownEffect(AiReviewProposal)(toolUse.input).pipe(
      Effect.mapError(
        (cause) =>
          new ReviewGenerationError({ message: "Claude returned an invalid review", cause }),
      ),
    );
  });

export class Reviews extends Context.Service<Reviews, ReviewsService>()("opensesh/Reviews") {}

export const ReviewsLive = Layer.effect(
  Reviews,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const loadAdminWorkspace = (eventId: string) =>
      Effect.gen(function* () {
        const apiKey = yield* Config.option(Config.string("ANTHROPIC_API_KEY")).pipe(
          Effect.orElseSucceed(() => Option.none<string>()),
        );
        const aiConfigured = Option.isSome(apiKey) && apiKey.value.trim().length > 0;
        const [
          roundRows,
          criterionRows,
          memberRows,
          assignmentRows,
          submissionRows,
          trackRows,
          aiRows,
          eventReviewerRows,
        ] = yield* Effect.all(
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
            query(database, "Could not list review pools", (db) =>
              db
                .select({ member: reviewRoundMembers, name: users.name, email: users.email })
                .from(reviewRoundMembers)
                .innerJoin(eventMembers, eq(eventMembers.id, reviewRoundMembers.eventMemberId))
                .innerJoin(users, eq(users.id, eventMembers.userId))
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewRoundMembers.roundId))
                .where(eq(reviewRounds.eventId, eventId))
                .orderBy(asc(users.name))
                .execute(),
            ),
            query(database, "Could not list review assignments", (db) =>
              db
                .select({
                  assignment: reviewAssignments,
                  reviewerName: users.name,
                  reviewerEmail: users.email,
                  answer: reviewAnswers,
                  criterion: reviewCriteria,
                })
                .from(reviewAssignments)
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewAssignments.roundId))
                .innerJoin(eventMembers, eq(eventMembers.id, reviewAssignments.eventMemberId))
                .innerJoin(users, eq(users.id, eventMembers.userId))
                .leftJoin(reviewAnswers, eq(reviewAnswers.assignmentId, reviewAssignments.id))
                .leftJoin(reviewCriteria, eq(reviewCriteria.id, reviewAnswers.criterionId))
                .where(eq(reviewRounds.eventId, eventId))
                .orderBy(asc(reviewAssignments.assignedAt), asc(reviewCriteria.position))
                .execute(),
            ),
            query(database, "Could not list evaluation submissions", (db) =>
              db
                .select({
                  submission: submissions,
                  trackId: tracks.id,
                  trackName: tracks.name,
                  participantName: users.name,
                  participantFirstName: contacts.firstName,
                  participantLastName: contacts.lastName,
                  participantRole: submissionParticipants.role,
                  participantContactId: contacts.id,
                  participantHeadshotUrl: contacts.headshotUrl,
                })
                .from(submissions)
                .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
                .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .leftJoin(users, eq(users.email, contacts.email))
                .where(and(eq(submissions.eventId, eventId), isNotNull(submissions.sourceFormId)))
                .orderBy(asc(submissions.code), asc(submissionParticipants.position))
                .execute(),
            ),
            query(database, "Could not list evaluation tracks", (db) =>
              db
                .select({ id: tracks.id, name: tracks.name, color: tracks.color })
                .from(tracks)
                .where(eq(tracks.eventId, eventId))
                .orderBy(asc(tracks.position))
                .execute(),
            ),
            query(database, "Could not list AI reviews", (db) =>
              db
                .select({ result: aiReviewResults, actorName: users.name })
                .from(aiReviewResults)
                .innerJoin(reviewRounds, eq(reviewRounds.id, aiReviewResults.roundId))
                .leftJoin(users, eq(users.id, aiReviewResults.overriddenByUserId))
                .where(eq(reviewRounds.eventId, eventId))
                .execute(),
            ),
            // The event's standing reviewer roster (event_members, not any
            // round's pool) — so a new round can offer them one-click instead
            // of making the organizer re-type people who already exist.
            query(database, "Could not list event reviewers", (db) =>
              db
                .select({ eventMemberId: eventMembers.id, name: users.name, email: users.email })
                .from(eventMembers)
                .innerJoin(users, eq(users.id, eventMembers.userId))
                .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.role, "reviewer")))
                .orderBy(asc(users.name))
                .execute(),
            ),
          ],
          { concurrency: 7 },
        );

        const decodedRounds = yield* decodeMany(ReviewRound, "review round", roundRows);
        const decodedCriteria = yield* decodeMany(
          ReviewCriterion,
          "review criterion",
          criterionRows.map((row) => row.criterion),
        );
        const decodedMembers = yield* decodeMany(
          ReviewRoundMember,
          "review round member",
          memberRows.map((row) => row.member),
        );
        const decodedAssignments = yield* decodeMany(
          ReviewAssignment,
          "review assignment",
          Array.from(
            new Map(assignmentRows.map((row) => [row.assignment.id, row.assignment])).values(),
          ),
        );
        const decodedAnswers = yield* decodeMany(
          ReviewAnswer,
          "review answer",
          Array.from(
            new Map(
              assignmentRows.flatMap((row) =>
                row.answer === null ? [] : [[row.answer.id, row.answer]],
              ),
            ).values(),
          ),
        );
        const decodedAiResults = yield* decodeMany(
          AiReviewResult,
          "AI review result",
          aiRows.map((row) => row.result),
        );
        const decodedSubmissions = yield* Effect.forEach(
          Array.from(new Set(submissionRows.map((row) => row.submission.id))),
          (submissionId) => {
            const group = submissionRows.filter((row) => row.submission.id === submissionId);
            const first = group[0];
            return decode(
              EvaluationSubmission,
              "evaluation submission",
              first === undefined
                ? undefined
                : {
                    id: first.submission.id,
                    code: first.submission.code,
                    title: first.submission.title,
                    description: first.submission.description,
                    status: first.submission.status,
                    submittedAt: first.submission.createdAt,
                    trackIds: Array.from(
                      new Set(group.flatMap((row) => (row.trackId === null ? [] : [row.trackId]))),
                    ),
                    trackNames: Array.from(
                      new Set(
                        group.flatMap((row) => (row.trackName === null ? [] : [row.trackName])),
                      ),
                    ),
                    participants: Array.from(
                      new Map(
                        group.flatMap((row) => {
                          if (row.participantRole === null) return [];
                          const name =
                            row.participantName ??
                            `${row.participantFirstName ?? ""} ${row.participantLastName ?? ""}`.trim();
                          return name.length === 0
                            ? []
                            : [
                                [
                                  `${name}:${row.participantRole}`,
                                  {
                                    name,
                                    role: row.participantRole,
                                    contactId: row.participantContactId,
                                    headshotUrl: row.participantHeadshotUrl,
                                  },
                                ],
                              ];
                        }),
                      ).values(),
                    ),
                  },
            );
          },
        );

        const roundViews: ReadonlyArray<ReviewRoundAdminView> = decodedRounds.map((round) => {
          const criteria = decodedCriteria.filter((criterion) => criterion.roundId === round.id);
          const members = decodedMembers.filter((member) => member.roundId === round.id);
          const roundAssignments = decodedAssignments.filter(
            (assignment) => assignment.roundId === round.id,
          );
          const reviewers = members.flatMap((member) => {
            const identity = memberRows.find((row) => row.member.id === member.id);
            return identity === undefined
              ? []
              : [{ member, name: identity.name, email: identity.email }];
          });
          const progress = reviewers.map((reviewer) => {
            const assigned = roundAssignments.filter(
              (assignment) => assignment.eventMemberId === reviewer.member.eventMemberId,
            );
            const completed = assigned.filter(
              (assignment) => assignment.status === "completed",
            ).length;
            const recused = assigned.filter((assignment) => assignment.status === "recused").length;
            const remaining = assigned.length - completed - recused;
            const required = assigned.length - recused;
            return {
              eventMemberId: reviewer.member.eventMemberId,
              name: reviewer.name,
              email: reviewer.email,
              assigned: assigned.length,
              completed,
              recused,
              remaining,
              percentage: required === 0 ? 0 : Math.round((completed / required) * 100),
            };
          });
          const results = decodedSubmissions.map((submission) => {
            const assigned = roundAssignments.filter(
              (assignment) => assignment.submissionId === submission.id,
            );
            const humanReviews = assigned.map((assignment) => {
              const identity = assignmentRows.find((row) => row.assignment.id === assignment.id);
              const answers = decodedAnswers
                .filter((answer) => answer.assignmentId === assignment.id)
                .flatMap((answer) => {
                  const criterion = criteria.find((item) => item.id === answer.criterionId);
                  return criterion === undefined
                    ? []
                    : [
                        {
                          criterionId: criterion.id,
                          label: criterion.label,
                          type: criterion.type,
                          numericValue: answer.numericValue,
                          textValue: answer.textValue,
                          optionValue: answer.optionValue,
                        },
                      ];
                });
              return {
                assignment,
                reviewerName: identity?.reviewerName ?? "Reviewer",
                reviewerEmail: identity?.reviewerEmail ?? "",
                answers,
              };
            });
            const completedReviews = humanReviews.filter(
              (review) => review.assignment.status === "completed",
            );
            const numeric = completedReviews.flatMap((review) =>
              review.answers.flatMap((answer) => {
                const criterion = criteria.find((item) => item.id === answer.criterionId);
                return answer.numericValue === null || criterion === undefined
                  ? []
                  : [{ value: answer.numericValue, weight: criterion.weight }];
              }),
            );
            const recommendations = Array.from(
              new Set(
                completedReviews.flatMap((review) =>
                  review.answers.flatMap((answer) =>
                    answer.type === "dropdown" && answer.optionValue !== null
                      ? [answer.optionValue]
                      : [],
                  ),
                ),
              ),
            );
            const aiResult =
              decodedAiResults.find(
                (result) => result.roundId === round.id && result.submissionId === submission.id,
              ) ?? null;
            const aiRow =
              aiResult === null ? undefined : aiRows.find((row) => row.result.id === aiResult.id);
            return {
              submission,
              humanReviews,
              reviewerCount: assigned.length,
              completedCount: completedReviews.length,
              weightedAggregate: weightedAggregate(numeric),
              recommendation: recommendations.length === 0 ? null : recommendations.join(", "),
              aiResult,
              aiOverriddenByName: aiRow?.actorName ?? null,
            };
          });
          return {
            configuration: { round, criteria, members },
            reviewers,
            assignments: roundAssignments,
            submissions: decodedSubmissions,
            progress,
            results,
          };
        });

        return yield* decode(EvaluationAdminWorkspace, "evaluation workspace", {
          eventId,
          aiConfigured,
          tracks: trackRows,
          eventReviewers: eventReviewerRows,
          rounds: roundViews,
        });
      });

    const loadReviewerWorkspace = (eventId: string, userId: string) =>
      Effect.gen(function* () {
        const memberRows = yield* query(database, "Could not load reviewer membership", (db) =>
          db
            .select({ member: eventMembers })
            .from(eventMembers)
            .where(
              and(
                eq(eventMembers.eventId, eventId),
                eq(eventMembers.userId, userId),
                eq(eventMembers.role, "reviewer"),
              ),
            )
            .limit(1)
            .execute(),
        );
        const eventMember = memberRows[0]?.member;
        if (eventMember === undefined) {
          return yield* Effect.fail(new Forbidden({ message: "You do not have reviewer access" }));
        }
        const [rows, identityRows] = yield* Effect.all(
          [
            query(database, "Could not load assigned reviews", (db) =>
              db
                .select({
                  round: reviewRounds,
                  criterion: reviewCriteria,
                  assignment: reviewAssignments,
                  submission: submissions,
                  trackName: tracks.name,
                  answer: reviewAnswers,
                })
                .from(reviewAssignments)
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewAssignments.roundId))
                .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
                .leftJoin(reviewCriteria, eq(reviewCriteria.roundId, reviewRounds.id))
                .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
                .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
                .leftJoin(reviewAnswers, eq(reviewAnswers.assignmentId, reviewAssignments.id))
                .where(
                  and(
                    eq(reviewRounds.eventId, eventId),
                    eq(reviewAssignments.eventMemberId, eventMember.id),
                  ),
                )
                .orderBy(
                  asc(reviewRounds.position),
                  asc(reviewAssignments.assignedAt),
                  asc(reviewCriteria.position),
                )
                .execute(),
            ),
            query(database, "Could not prepare blind review data", (db) =>
              db
                .select({
                  submissionId: submissionParticipants.submissionId,
                  role: submissionParticipants.role,
                  contactId: contacts.id,
                  headshotUrl: contacts.headshotUrl,
                  firstName: contacts.firstName,
                  lastName: contacts.lastName,
                  company: contacts.company,
                  email: contacts.email,
                  linkedinUrl: contacts.linkedinUrl,
                  twitterUrl: contacts.twitterUrl,
                  facebookUrl: contacts.facebookUrl,
                  websiteUrl: contacts.websiteUrl,
                })
                .from(submissionParticipants)
                .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .innerJoin(
                  reviewAssignments,
                  eq(reviewAssignments.submissionId, submissionParticipants.submissionId),
                )
                .innerJoin(reviewRounds, eq(reviewRounds.id, reviewAssignments.roundId))
                .where(
                  and(
                    eq(reviewRounds.eventId, eventId),
                    eq(reviewAssignments.eventMemberId, eventMember.id),
                  ),
                )
                .orderBy(asc(submissionParticipants.position))
                .execute(),
            ),
          ],
          { concurrency: 2 },
        );
        const decodedRounds = yield* decodeMany(
          ReviewRound,
          "review round",
          Array.from(new Map(rows.map((row) => [row.round.id, row.round])).values()),
        );
        const decodedCriteria = yield* decodeMany(
          ReviewCriterion,
          "review criterion",
          Array.from(
            new Map(
              rows.flatMap((row) =>
                row.criterion === null ? [] : [[row.criterion.id, row.criterion]],
              ),
            ).values(),
          ),
        );
        const decodedAssignments = yield* decodeMany(
          ReviewAssignment,
          "review assignment",
          Array.from(new Map(rows.map((row) => [row.assignment.id, row.assignment])).values()),
        );
        const decodedAnswers = yield* decodeMany(
          ReviewAnswer,
          "review answer",
          Array.from(
            new Map(
              rows.flatMap((row) => (row.answer === null ? [] : [[row.answer.id, row.answer]])),
            ).values(),
          ),
        );
        return yield* decode(ReviewerWorkspace, "reviewer workspace", {
          eventId,
          eventMemberId: eventMember.id,
          rounds: decodedRounds.map((round) => {
            const assignments = decodedAssignments.filter(
              (assignment) => assignment.roundId === round.id,
            );
            return {
              round,
              criteria: decodedCriteria.filter((criterion) => criterion.roundId === round.id),
              items: assignments.flatMap((assignment) => {
                const row = rows.find((item) => item.assignment.id === assignment.id);
                if (row === undefined) return [];
                const identities = identityRows.filter(
                  (identity) => identity.submissionId === assignment.submissionId,
                );
                const speakerNames = identities.map(
                  (identity) => `${identity.firstName} ${identity.lastName}`,
                );
                const identityValues = identities.flatMap((identity) => [
                  ...(identity.company === null ? [] : [identity.company]),
                  identity.email,
                  ...(identity.linkedinUrl === null ? [] : [identity.linkedinUrl]),
                  ...(identity.twitterUrl === null ? [] : [identity.twitterUrl]),
                  ...(identity.facebookUrl === null ? [] : [identity.facebookUrl]),
                  ...(identity.websiteUrl === null ? [] : [identity.websiteUrl]),
                ]);
                const safe = round.blind
                  ? redactBlindSubmission({
                      code: row.submission.code,
                      title: row.submission.title,
                      description: row.submission.description,
                      speakerNames,
                      companies: identityValues,
                      submitterEmail: null,
                    })
                  : {
                      code: row.submission.code,
                      title: row.submission.title,
                      description: row.submission.description,
                    };
                return [
                  {
                    assignment,
                    ...safe,
                    status: row.submission.status,
                    trackNames: Array.from(
                      new Set(
                        rows.flatMap((item) =>
                          item.assignment.id === assignment.id && item.trackName !== null
                            ? [item.trackName]
                            : [],
                        ),
                      ),
                    ),
                    participants: round.blind
                      ? []
                      : identities.map((identity) => ({
                          name: `${identity.firstName} ${identity.lastName}`,
                          role: identity.role,
                          contactId: identity.contactId,
                          headshotUrl: identity.headshotUrl,
                        })),
                    answers: decodedAnswers.filter(
                      (answer) => answer.assignmentId === assignment.id,
                    ),
                  },
                ];
              }),
              pending: assignments.filter((assignment) => assignment.status === "pending").length,
              completed: assignments.filter((assignment) => assignment.status === "completed")
                .length,
              recused: assignments.filter((assignment) => assignment.status === "recused").length,
            };
          }),
        });
      });

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
      adminWorkspace: loadAdminWorkspace,
      eventMemberId: (eventId, userId) =>
        query(database, "Could not load event membership", (db) =>
          db
            .select({ id: eventMembers.id })
            .from(eventMembers)
            .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
            .limit(1)
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.fail(new NotFound({ message: "Event member not found" }))
              : Effect.succeed(rows[0].id),
          ),
        ),
      reviewerWorkspace: loadReviewerWorkspace,
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
            const retainedIds = criteria.flatMap((criterion) =>
              criterion.id === null ? [] : [criterion.id],
            );
            await transaction
              .delete(reviewCriteria)
              .where(
                and(
                  eq(reviewCriteria.roundId, roundId),
                  retainedIds.length === 0 ? undefined : notInArray(reviewCriteria.id, retainedIds),
                ),
              )
              .execute();
            for (const criterion of criteria) {
              const { id, ...values } = criterion;
              if (id === null) {
                await transaction
                  .insert(reviewCriteria)
                  .values({ ...values, roundId })
                  .execute();
              } else {
                await transaction
                  .update(reviewCriteria)
                  .set({ ...values, updatedAt: new Date() })
                  .where(and(eq(reviewCriteria.id, id), eq(reviewCriteria.roundId, roundId)))
                  .execute();
              }
            }
            return await transaction
              .select()
              .from(reviewCriteria)
              .where(eq(reviewCriteria.roundId, roundId))
              .orderBy(asc(reviewCriteria.position))
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
      provisionMember: (input) =>
        query(database, "Could not add reviewer", (db) =>
          db.transaction(async (transaction) => {
            const email = input.email.trim().toLowerCase();
            const [round] = await transaction
              .select({ round: reviewRounds, event: events })
              .from(reviewRounds)
              .innerJoin(events, eq(events.id, reviewRounds.eventId))
              .where(eq(reviewRounds.id, input.roundId))
              .limit(1)
              .execute();
            if (round === undefined) return { kind: "notFound" as const };
            let [user] = await transaction
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1)
              .execute();
            if (user === undefined) {
              const [created] = await transaction
                .insert(users)
                .values({ email, name: input.name.trim() })
                .returning()
                .execute();
              user = created;
            } else if (input.name.trim().length > 0 && user.name !== input.name.trim()) {
              const [updated] = await transaction
                .update(users)
                .set({ name: input.name.trim(), updatedAt: new Date() })
                .where(eq(users.id, user.id))
                .returning()
                .execute();
              user = updated;
            }
            if (user === undefined) return { kind: "notFound" as const };
            await transaction
              .insert(organizationMembers)
              .values({
                organizationId: round.event.organizationId,
                userId: user.id,
                role: "member",
              })
              .onConflictDoNothing()
              .execute();
            await transaction
              .insert(eventMembers)
              .values({ eventId: round.event.id, userId: user.id, role: "reviewer" })
              .onConflictDoNothing()
              .execute();
            const [eventMember] = await transaction
              .select()
              .from(eventMembers)
              .where(
                and(eq(eventMembers.eventId, round.event.id), eq(eventMembers.userId, user.id)),
              )
              .limit(1)
              .execute();
            if (eventMember === undefined) return { kind: "notFound" as const };
            const [existing] = await transaction
              .select()
              .from(reviewRoundMembers)
              .where(
                and(
                  eq(reviewRoundMembers.roundId, round.round.id),
                  eq(reviewRoundMembers.eventMemberId, eventMember.id),
                ),
              )
              .limit(1)
              .execute();
            const [member] =
              existing === undefined
                ? await transaction
                    .insert(reviewRoundMembers)
                    .values({
                      roundId: round.round.id,
                      eventMemberId: eventMember.id,
                      assignmentCap: input.assignmentCap,
                    })
                    .returning()
                    .execute()
                : await transaction
                    .update(reviewRoundMembers)
                    .set({ assignmentCap: input.assignmentCap, updatedAt: new Date() })
                    .where(eq(reviewRoundMembers.id, existing.id))
                    .returning()
                    .execute();
            if (member === undefined) return { kind: "notFound" as const };
            let invitationLogged = false;
            let invitationLogId: string | null = null;
            if (existing === undefined) {
              // The web client passes a full /login URL; API callers may pass a
              // bare path, which resolves against the canonical origin.
              const accessUrl = new URL(input.accessPath, "https://app.opensesh.io").toString();
              const rendered = reviewerInvitation({
                eventName: round.event.name,
                logoUrl: round.event.logoUrl,
                reviewerName: user.name,
                roundName: round.round.name,
                accessUrl,
              });
              const [invitation] = await transaction
                .insert(emailLog)
                .values({
                  eventId: round.event.id,
                  contactId: null,
                  submissionId: null,
                  type: "custom",
                  recipient: email,
                  subject: rendered.subject,
                  body: rendered.text,
                  htmlBody: rendered.html,
                  icsAttached: false,
                  icsContent: null,
                  icsSequence: null,
                  status: "queued",
                  provider: null,
                  providerId: null,
                  error: null,
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute();
              invitationLogged = true;
              invitationLogId = invitation?.id ?? null;
            }
            return {
              kind: "ok" as const,
              member,
              name: user.name,
              email: user.email,
              alreadyInPool: existing !== undefined,
              invitationLogged,
              invitationLogId,
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            outcome.kind === "notFound"
              ? decodeFound(ReviewerProvisioned, "Reviewer", undefined)
              : decode(ReviewerProvisioned, "reviewer access", {
                  reviewer: {
                    member: outcome.member,
                    name: outcome.name,
                    email: outcome.email,
                  },
                  accessPath: input.accessPath,
                  alreadyInPool: outcome.alreadyInPool,
                  invitationLogged: outcome.invitationLogged,
                  invitationLogId: outcome.invitationLogId,
                }),
          ),
        ),
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
            if (existing !== undefined)
              return { kind: "ok" as const, row: existing, created: false };
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
            if (created !== undefined) return { kind: "ok" as const, row: created, created: true };
            const [concurrent] = await transaction
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
            return concurrent === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: concurrent, created: false };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              ReviewAssignmentMutation,
              DbError | NotFound | RoundClosed | AssignmentCapExceeded
            > => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignmentMutation, "Review assignment", undefined);
              if (outcome.kind === "closed")
                return Effect.fail(new RoundClosed({ message: "This review round is closed" }));
              if (outcome.kind === "cap")
                return Effect.fail(
                  new AssignmentCapExceeded({
                    message: "This reviewer has reached their assignment cap",
                  }),
                );
              return decode(ReviewAssignmentMutation, "review assignment mutation", {
                assignment: outcome.row,
                created: outcome.created,
              });
            },
          ),
        ),
      autoDistribute: (roundId, trackIds, dryRun) =>
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
            const [members, existing, candidates] = await Promise.all([
              transaction
                .select({
                  member: reviewRoundMembers,
                  email: users.email,
                })
                .from(reviewRoundMembers)
                .innerJoin(eventMembers, eq(eventMembers.id, reviewRoundMembers.eventMemberId))
                .innerJoin(users, eq(users.id, eventMembers.userId))
                .where(eq(reviewRoundMembers.roundId, roundId))
                .execute(),
              transaction
                .select()
                .from(reviewAssignments)
                .where(eq(reviewAssignments.roundId, roundId))
                .execute(),
              transaction
                .select({ id: submissions.id, code: submissions.code })
                .from(submissions)
                .where(
                  and(
                    eq(submissions.eventId, round.eventId),
                    inArray(submissions.status, ["pending", "maybe"]),
                  ),
                )
                .execute(),
            ]);
            const memberIds = members.map((row) => row.member.eventMemberId);
            const candidateIds = candidates.map((candidate) => candidate.id);
            const [candidateTracks, affinities, participantEmails] = await Promise.all([
              candidateIds.length === 0
                ? Promise.resolve([])
                : transaction
                    .select({
                      submissionId: submissionTracks.submissionId,
                      trackId: submissionTracks.trackId,
                    })
                    .from(submissionTracks)
                    .where(inArray(submissionTracks.submissionId, candidateIds))
                    .execute(),
              memberIds.length === 0
                ? Promise.resolve([])
                : transaction
                    .select({
                      eventMemberId: reviewerTracks.eventMemberId,
                      trackId: reviewerTracks.trackId,
                    })
                    .from(reviewerTracks)
                    .where(inArray(reviewerTracks.eventMemberId, memberIds))
                    .execute(),
              candidateIds.length === 0
                ? Promise.resolve([])
                : transaction
                    .select({
                      submissionId: submissionParticipants.submissionId,
                      email: contacts.email,
                    })
                    .from(submissionParticipants)
                    .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                    .where(inArray(submissionParticipants.submissionId, candidateIds))
                    .execute(),
            ]);
            const allowed = new Set(
              candidateTracks.flatMap((row) =>
                trackIds.length === 0 || trackIds.includes(row.trackId) ? [row.submissionId] : [],
              ),
            );
            const scopedCandidates = candidates.filter(
              (candidate) => trackIds.length === 0 || allowed.has(candidate.id),
            );
            const normalizedParticipantEmails = new Map<string, Set<string>>();
            for (const participant of participantEmails) {
              const emails = normalizedParticipantEmails.get(participant.submissionId) ?? new Set();
              emails.add(participant.email.trim().toLowerCase());
              normalizedParticipantEmails.set(participant.submissionId, emails);
            }
            const plan = planAutoDistribution({
              submissions: scopedCandidates.map((candidate) => ({
                ...candidate,
                trackIds: candidateTracks.flatMap((row) =>
                  row.submissionId === candidate.id ? [row.trackId] : [],
                ),
              })),
              members: members.map(({ member, email }) => ({
                eventMemberId: member.eventMemberId,
                assignmentCap: member.assignmentCap,
                trackIds: affinities.flatMap((row) =>
                  row.eventMemberId === member.eventMemberId ? [row.trackId] : [],
                ),
                conflictedSubmissionIds: scopedCandidates.flatMap((candidate) =>
                  normalizedParticipantEmails.get(candidate.id)?.has(email.trim().toLowerCase()) ===
                  true
                    ? [candidate.id]
                    : [],
                ),
              })),
              existing: existing.map((assignment) => ({
                submissionId: assignment.submissionId,
                eventMemberId: assignment.eventMemberId,
                status: assignment.status,
              })),
              reviewsPerSubmission: round.reviewsPerSubmission,
            });
            if (dryRun || plan.planned.length === 0) {
              return { kind: "ok" as const, plan, created: 0, skipped: 0 };
            }
            const created = await transaction
              .insert(reviewAssignments)
              .values(
                plan.planned.map(({ tier: _tier, ...item }) => ({
                  ...item,
                  roundId,
                  assignedAt: new Date(),
                })),
              )
              .onConflictDoNothing()
              .returning()
              .execute();
            return {
              kind: "ok" as const,
              plan,
              created: created.length,
              skipped: plan.planned.length - created.length,
            };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<ReviewAssignmentBatch, DbError | NotFound | RoundClosed> => {
              if (outcome.kind === "notFound")
                return decodeFound(ReviewAssignmentBatch, "Review round", undefined);
              if (outcome.kind === "closed")
                return Effect.fail(new RoundClosed({ message: "This review round is closed" }));
              return decode(ReviewAssignmentBatch, "review assignment batch", {
                planned: outcome.plan.planned,
                created: outcome.created,
                skipped: outcome.skipped,
                outOfTrack: outcome.plan.stats.outOfTrack,
                conflictsSkipped: outcome.plan.stats.conflictsSkipped,
                shortfalls: outcome.plan.shortfalls,
              });
            },
          ),
        ),
      unassign: (roundId, assignmentId) =>
        query(database, "Could not unassign review", (db) =>
          db
            .delete(reviewAssignments)
            .where(
              and(eq(reviewAssignments.id, assignmentId), eq(reviewAssignments.roundId, roundId)),
            )
            .returning({ id: reviewAssignments.id })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? decodeFound(ReviewAssignment, "Review assignment", undefined).pipe(Effect.asVoid)
              : Effect.void,
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
            if (assignment.status === "recused") return { kind: "forbidden" as const };
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
            for (const criterion of criteria) {
              const required = validateRequiredReviewAnswer(
                criterion,
                answers.find((answer) => answer.criterionId === criterion.id),
              );
              if (required !== undefined) return { kind: "invalid" as const, error: required };
            }
            const answerIds = new Set(answers.map((answer) => answer.criterionId));
            if (answerIds.size !== answers.length) {
              return {
                kind: "invalid" as const,
                error: new InvalidInput({ message: "Submit one answer per criterion" }),
              };
            }
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
      queueReminders: (roundId, eventMemberIds, portalOrigin) =>
        query(database, "Could not queue review reminders", (db) =>
          db.transaction(async (transaction) => {
            const [round] = await transaction
              .select({ round: reviewRounds, event: events })
              .from(reviewRounds)
              .innerJoin(events, eq(events.id, reviewRounds.eventId))
              .where(eq(reviewRounds.id, roundId))
              .limit(1)
              .execute();
            if (round === undefined) return { kind: "notFound" as const, rows: [] };
            const selected = Array.from(new Set(eventMemberIds));
            if (selected.length === 0) return { kind: "ok" as const, rows: [] };
            const reviewers = await transaction
              .select({ eventMemberId: eventMembers.id, name: users.name, email: users.email })
              .from(reviewRoundMembers)
              .innerJoin(eventMembers, eq(eventMembers.id, reviewRoundMembers.eventMemberId))
              .innerJoin(users, eq(users.id, eventMembers.userId))
              .where(
                and(eq(reviewRoundMembers.roundId, roundId), inArray(eventMembers.id, selected)),
              )
              .execute();
            const assignments = await transaction
              .select({ eventMemberId: reviewAssignments.eventMemberId })
              .from(reviewAssignments)
              .where(
                and(
                  eq(reviewAssignments.roundId, roundId),
                  eq(reviewAssignments.status, "pending"),
                  inArray(reviewAssignments.eventMemberId, selected),
                ),
              )
              .execute();
            const reminders = reviewers.flatMap((reviewer) => {
              const pending = assignments.filter(
                (assignment) => assignment.eventMemberId === reviewer.eventMemberId,
              ).length;
              return pending === 0 ? [] : [{ ...reviewer, pending }];
            });
            if (reminders.length === 0) return { kind: "ok" as const, rows: [] };
            const deadline = new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: round.event.timezone,
            }).format(round.round.closesAt);
            const inserted = await transaction
              .insert(emailLog)
              .values(
                reminders.map((reminder) => {
                  // Sign-in link with the reviewer's email prefilled — their
                  // address is the credential — landing on the review queue.
                  const reviewUrl = `${portalOrigin}/login?email=${encodeURIComponent(reminder.email)}&redirect=${encodeURIComponent("/admin/evaluation")}`;
                  const rendered = reviewReminder({
                    eventName: round.event.name,
                    logoUrl: round.event.logoUrl,
                    reviewerName: reminder.name,
                    roundName: round.round.name,
                    pending: reminder.pending,
                    deadline,
                    reviewUrl,
                  });
                  return {
                    eventId: round.event.id,
                    contactId: null,
                    submissionId: null,
                    type: "custom" as const,
                    recipient: reminder.email,
                    subject: rendered.subject,
                    body: rendered.text,
                    htmlBody: rendered.html,
                    icsAttached: false,
                    icsContent: null,
                    icsSequence: null,
                    status: "queued" as const,
                    provider: null,
                    providerId: null,
                    error: null,
                    sentAt: null,
                  };
                }),
              )
              .returning({ id: emailLog.id, recipient: emailLog.recipient })
              .execute();
            return {
              kind: "ok" as const,
              rows: inserted.flatMap((row) => {
                const reminder = reminders.find((item) => item.email === row.recipient);
                return reminder === undefined
                  ? []
                  : [{ logId: row.id, recipient: row.recipient, pending: reminder.pending }];
              }),
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            outcome.kind === "notFound"
              ? decodeFound(ReviewReminder, "Review round", undefined).pipe(
                  Effect.map((item) => [item]),
                )
              : decodeMany(ReviewReminder, "review reminder", outcome.rows),
          ),
        ),
      generateAiResult: (roundId, submissionId) =>
        Effect.gen(function* () {
          const [roundRows, submissionRows, criterionRows] = yield* Effect.all(
            [
              query(database, "Could not load AI review round", (db) =>
                db
                  .select()
                  .from(reviewRounds)
                  .where(eq(reviewRounds.id, roundId))
                  .limit(1)
                  .execute(),
              ),
              query(database, "Could not load AI review submission", (db) =>
                db
                  .select()
                  .from(submissions)
                  .where(eq(submissions.id, submissionId))
                  .limit(1)
                  .execute(),
              ),
              query(database, "Could not load AI review criteria", (db) =>
                db
                  .select()
                  .from(reviewCriteria)
                  .where(eq(reviewCriteria.roundId, roundId))
                  .orderBy(asc(reviewCriteria.position))
                  .execute(),
              ),
            ],
            { concurrency: 3 },
          );
          const round = yield* decodeFound(ReviewRound, "Review round", roundRows[0]);
          const submission = yield* decodeFound(Submission, "Submission", submissionRows[0]);
          if (submission.eventId !== round.eventId) {
            return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
          }
          const criteria = yield* decodeMany(ReviewCriterion, "review criterion", criterionRows);
          const apiKey = yield* Config.option(Config.string("ANTHROPIC_API_KEY")).pipe(
            Effect.mapError(
              (cause) =>
                new ReviewGenerationError({
                  message: "Anthropic configuration is invalid",
                  cause,
                }),
            ),
          );
          if (Option.isNone(apiKey)) {
            return yield* Effect.fail(
              new ReviewGenerationError({
                message: "AI first-pass is unavailable because Anthropic is not configured",
                cause: "ANTHROPIC_API_KEY is missing",
              }),
            );
          }
          const proposal = yield* requestAiReview({
            apiKey: apiKey.value,
            title: submission.title,
            description: submission.description,
            criteria,
          });
          return yield* query(database, "Could not save AI review", (db) =>
            db
              .insert(aiReviewResults)
              .values({
                roundId,
                submissionId,
                score: proposal.score,
                reasoning: proposal.reasoning,
                provider: "anthropic",
                model: AI_REVIEW_MODEL,
              })
              .onConflictDoUpdate({
                target: [aiReviewResults.roundId, aiReviewResults.submissionId],
                set: {
                  score: proposal.score,
                  reasoning: proposal.reasoning,
                  provider: "anthropic",
                  model: AI_REVIEW_MODEL,
                  overriddenScore: null,
                  overrideReason: null,
                  overriddenByUserId: null,
                  overriddenAt: null,
                  updatedAt: new Date(),
                },
              })
              .returning()
              .execute(),
          ).pipe(Effect.flatMap((rows) => decode(AiReviewResult, "AI review result", rows[0])));
        }),
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
      overrideAiResult: (id, score, reason, actor) =>
        query(database, "Could not override AI review", (db) =>
          db
            .update(aiReviewResults)
            .set({
              overriddenScore: score,
              overrideReason: reason,
              overriddenByUserId: actor.kind === "user" ? actor.userId : null,
              overriddenByApiKeyId: actor.kind === "api_key" ? actor.apiKeyId : null,
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
