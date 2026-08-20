import {
  AddReviewMemberRequest,
  AssignReviewsRequest,
  AutoDistributeReviewsRequest,
  EvaluationEventRequest,
  ExportReviewResultsRequest,
  Forbidden,
  GenerateAiReviewRequest,
  InvalidInput,
  ListReviewerTracksRequest,
  OverrideAiReviewRequest,
  RecuseReviewRequest,
  SaveReviewRoundRequest,
  SetReviewerTracksRequest,
  SendReviewRemindersRequest,
  SubmitReviewAnswersRequest,
  UnassignReviewRequest,
  type ReviewCriterionSave,
} from "@opensesh/domain";
import { getCurrentUser, requireEventAccess } from "@opensesh/domain/server/current-user";
import { Mail } from "@opensesh/domain/server/mail";
import { Events, Reviews } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";
import { MailQueue } from "@/server/mail-queue";

const requireAdminEvent = (eventId: string) => requireEventAccess(eventId, "admin");

const requireRound = Effect.fn("requireEvaluationRound")(function* (
  eventId: string,
  roundId: string,
) {
  const reviews = yield* Reviews;
  const rounds = yield* reviews.listRounds(eventId);
  const round = rounds.find((item) => item.round.id === roundId);
  if (round === undefined) {
    return yield* Effect.fail(
      new Forbidden({ message: "This round does not belong to the event" }),
    );
  }
  return round;
});

const dateOrFail = (value: string, label: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? Effect.fail(new InvalidInput({ message: `Enter a valid ${label}` }))
    : Effect.succeed(date);
};

const normalizeCriteria = (
  criteria: ReadonlyArray<ReviewCriterionSave>,
): Effect.Effect<ReadonlyArray<ReviewCriterionSave>, InvalidInput> => {
  const labels = criteria.map((criterion) => criterion.label.trim().toLowerCase());
  if (labels.some((label) => label.length === 0)) {
    return Effect.fail(new InvalidInput({ message: "Name every scorecard criterion" }));
  }
  if (new Set(labels).size !== labels.length) {
    return Effect.fail(new InvalidInput({ message: "Criterion names must be unique" }));
  }
  const normalized: Array<ReviewCriterionSave> = [];
  for (const [index, criterion] of criteria.entries()) {
    const label = criterion.label.trim();
    if (criterion.type === "numeric") {
      if (
        criterion.min === null ||
        criterion.max === null ||
        !Number.isFinite(criterion.min) ||
        !Number.isFinite(criterion.max) ||
        criterion.min >= criterion.max
      ) {
        return Effect.fail(
          new InvalidInput({ message: `${label} needs a minimum below its maximum` }),
        );
      }
      if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) {
        return Effect.fail(new InvalidInput({ message: `${label} needs a positive weight` }));
      }
      normalized.push({
        ...criterion,
        label,
        options: [],
        position: index + 1,
      });
      continue;
    }
    if (criterion.type === "dropdown") {
      const options = criterion.options.map((option) => option.trim()).filter(Boolean);
      if (
        options.length < 2 ||
        new Set(options.map((option) => option.toLowerCase())).size !== options.length
      ) {
        return Effect.fail(
          new InvalidInput({ message: `${label} needs at least two unique options` }),
        );
      }
      normalized.push({
        ...criterion,
        label,
        min: null,
        max: null,
        options,
        weight: 1,
        position: index + 1,
      });
      continue;
    }
    normalized.push({
      ...criterion,
      label,
      min: null,
      max: null,
      options: [],
      weight: 1,
      position: index + 1,
    });
  }
  return Effect.succeed(normalized);
};

export const getAdminEvaluation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EvaluationEventRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const reviews = yield* Reviews;
        return yield* reviews.adminWorkspace(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const getReviewerEvaluation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EvaluationEventRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You do not have reviewer access" }));
        }
        const reviews = yield* Reviews;
        return yield* reviews.reviewerWorkspace(data.eventId, access.user.userId);
      }),
      { require: "session" },
    ),
  );

export const saveReviewRound = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SaveReviewRoundRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        if (data.roundId !== null) yield* requireRound(data.eventId, data.roundId);
        const name = data.name.trim();
        if (name.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Name this review round" }));
        }
        if (!Number.isInteger(data.position) || data.position < 1) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Round position must be a whole number of at least 1" }),
          );
        }
        const [opensAt, closesAt, criteria] = yield* Effect.all([
          dateOrFail(data.opensAt, "open time"),
          dateOrFail(data.closesAt, "close time"),
          normalizeCriteria(data.criteria),
        ]);
        if (closesAt <= opensAt) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Close time must be after open time" }),
          );
        }
        const now = new Date();
        const status = now < opensAt ? "draft" : now > closesAt ? "closed" : "open";
        const reviews = yield* Reviews;
        const round = yield* reviews.saveRound({
          id: data.roundId,
          eventId: data.eventId,
          name,
          opensAt,
          closesAt,
          blind: data.blind,
          reviewsPerSubmission: data.reviewsPerSubmission,
          position: data.position,
          status,
        });
        yield* reviews.saveCriteria(round.id, criteria);
        const workspace = yield* reviews.adminWorkspace(data.eventId);
        return { roundId: round.id, workspace };
      }),
      { require: "staff" },
    ),
  );

export const addReviewMember = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AddReviewMemberRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        if (data.name.trim().length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Reviewer name is required" }));
        }
        if (
          data.assignmentCap !== null &&
          (!Number.isInteger(data.assignmentCap) || data.assignmentCap < 1)
        ) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Assignment cap must be a whole number of at least 1" }),
          );
        }
        const reviews = yield* Reviews;
        const mail = yield* Mail;
        const provisioned = yield* reviews.provisionMember({
          roundId: data.roundId,
          name: data.name,
          email: data.email,
          assignmentCap: data.assignmentCap,
          accessPath: data.accessPath,
        });
        if (provisioned.invitationLogId !== null) {
          yield* mail.sendQueued(provisioned.invitationLogId);
        }
        return provisioned;
      }),
      { require: "staff" },
    ),
  );

export const assignReviews = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AssignReviewsRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        const submissionIds = Array.from(new Set(data.submissionIds));
        const assignments = yield* Effect.forEach(
          submissionIds,
          (submissionId) => reviews.assign(data.roundId, submissionId, data.eventMemberId),
          { concurrency: 1 },
        );
        const created = assignments.filter((assignment) => assignment.created).length;
        return { created, skipped: assignments.length - created };
      }),
      { require: "staff" },
    ),
  );

export const autoDistributeReviews = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AutoDistributeReviewsRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        return yield* reviews.autoDistribute(data.roundId, data.trackIds, data.dryRun ?? false);
      }),
      { require: "staff" },
    ),
  );

export const getReviewerTracks = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ListReviewerTracksRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const events = yield* Events;
        return yield* events.listReviewerTracks(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const setReviewerTracks = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SetReviewerTracksRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        if (data.roundId !== undefined) {
          yield* requireRound(data.eventId, data.roundId);
          if (
            data.assignmentCap !== undefined &&
            data.assignmentCap !== null &&
            (!Number.isInteger(data.assignmentCap) || data.assignmentCap < 1)
          ) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Assignment cap must be a whole number of at least 1" }),
            );
          }
        }
        const events = yield* Events;
        const trackSet = yield* events.setReviewerTracks(
          data.eventId,
          data.eventMemberId,
          data.trackIds,
        );
        if (data.roundId !== undefined && data.assignmentCap !== undefined) {
          const reviews = yield* Reviews;
          yield* reviews.addMember(data.roundId, data.eventMemberId, data.assignmentCap);
        }
        return trackSet;
      }),
      { require: "staff" },
    ),
  );

export const unassignReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(UnassignReviewRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        yield* reviews.unassign(data.roundId, data.assignmentId);
        return { unassigned: 1 };
      }),
      { require: "staff" },
    ),
  );

export const submitReviewAnswers = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SubmitReviewAnswersRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot submit this review" }));
        }
        const reviews = yield* Reviews;
        const eventMemberId = yield* reviews.eventMemberId(data.eventId, access.user.userId);
        return yield* reviews.submitAnswers(data.assignmentId, eventMemberId, data.answers);
      }),
      { require: "session" },
    ),
  );

export const recuseReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RecuseReviewRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "reviewer");
        if (access.admin) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot recuse this review" }));
        }
        const reviews = yield* Reviews;
        const eventMemberId = yield* reviews.eventMemberId(data.eventId, access.user.userId);
        return yield* reviews.recuse(data.assignmentId, eventMemberId, data.reason.trim());
      }),
      { require: "session" },
    ),
  );

export const sendReviewReminders = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SendReviewRemindersRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        const reminders = yield* reviews.queueReminders(
          data.roundId,
          data.eventMemberIds,
          new URL(getRequest().url).origin,
        );
        const queue = yield* MailQueue;
        yield* queue.enqueue(reminders.map((reminder) => reminder.logId));
        return {
          queued: reminders.length,
          sent: 0,
          failed: 0,
        };
      }),
      { require: "staff" },
    ),
  );

export const generateAiReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(GenerateAiReviewRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        return yield* reviews.generateAiResult(data.roundId, data.submissionId);
      }),
      { require: "staff" },
    ),
  );

export const overrideAiReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OverrideAiReviewRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        if (!Number.isFinite(data.score)) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a valid override score" }));
        }
        const reason = data.reason.trim();
        if (reason.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Explain the override" }));
        }
        const reviews = yield* Reviews;
        const workspace = yield* reviews.adminWorkspace(data.eventId);
        const result = workspace.rounds
          .flatMap((round) => round.results)
          .flatMap((row) => (row.aiResult?.id === data.resultId ? [row.aiResult] : []))[0];
        if (result === undefined) {
          return yield* Effect.fail(
            new Forbidden({ message: "This AI result is not in the event" }),
          );
        }
        const user = yield* getCurrentUser;
        return yield* reviews.overrideAiResult(result.id, data.score, reason, {
          kind: "user",
          userId: user.userId,
          name: user.name,
        });
      }),
      { require: "staff" },
    ),
  );

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const exportReviewResults = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ExportReviewResultsRequest))
  .handler(async ({ data }) => {
    const result = await runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        yield* requireRound(data.eventId, data.roundId);
        const reviews = yield* Reviews;
        const workspace = yield* reviews.adminWorkspace(data.eventId);
        const view = workspace.rounds.find(
          (round) => round.configuration.round.id === data.roundId,
        );
        if (view === undefined) {
          return yield* Effect.fail(new Forbidden({ message: "This round is not available" }));
        }
        const criterionHeaders = view.configuration.criteria.map((criterion) => criterion.label);
        const headers = [
          "Round",
          "Submission code",
          "Submission",
          "Submission status",
          "Participants",
          "Reviewer",
          ...criterionHeaders,
          "Weighted total",
          "Recommendation",
          "Recusal",
          "Review status",
        ];
        const rows = view.results.flatMap((row) => {
          const participants = row.submission.participants
            .map((participant) => `${participant.name} (${participant.role})`)
            .join("; ");
          const reviews = row.humanReviews.length === 0 ? [null] : row.humanReviews;
          return reviews.map((review) => [
            view.configuration.round.name,
            row.submission.code,
            row.submission.title,
            row.submission.status,
            participants,
            review?.reviewerName ?? "",
            ...view.configuration.criteria.map((criterion) => {
              const answer = review?.answers.find((item) => item.criterionId === criterion.id);
              return (
                answer?.numericValue?.toString() ?? answer?.optionValue ?? answer?.textValue ?? ""
              );
            }),
            row.weightedAggregate?.toFixed(2) ?? "",
            row.recommendation ?? "",
            review?.assignment.recusalReason ?? "",
            review?.assignment.status ?? "unassigned",
          ]);
        });
        return [headers, ...rows]
          .map((row) => row.map((value) => csvCell(value)).join(","))
          .join("\r\n");
      }),
      { require: "staff" },
    );
    if (!result.ok) return new Response(result.error.message, { status: result.error.status });
    const roundSlug = data.roundId.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
    return new Response(result.data, {
      headers: {
        "Content-Disposition": `attachment; filename="evaluation-${roundSlug}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  });
