import { ReviewCriterionSave, type ReviewCriterionSave as CriterionType } from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import { Reviews } from "@opensesh/domain/server/repos";
import {
  AiReviewResult,
  EvaluationAdminWorkspace,
  ReviewerProvisioned,
} from "@opensesh/domain/server/schema/reviews";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const requireRound = Effect.fn("apiRequireRound")(function* (eventId: string, roundId: string) {
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
    ? Effect.fail(new InvalidInput({ message: `${label} is not a valid ISO date` }))
    : Effect.succeed(date);
};

const normalizeCriteria = (
  criteria: ReadonlyArray<CriterionType>,
): Effect.Effect<ReadonlyArray<CriterionType>, InvalidInput> => {
  const labels = criteria.map((criterion) => criterion.label.trim().toLowerCase());
  if (labels.some((label) => label.length === 0)) {
    return Effect.fail(new InvalidInput({ message: "Name every scorecard criterion" }));
  }
  if (new Set(labels).size !== labels.length) {
    return Effect.fail(new InvalidInput({ message: "Criterion names must be unique" }));
  }
  const normalized: Array<CriterionType> = [];
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
      normalized.push({ ...criterion, label, options: [], position: index + 1 });
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

const RoundBody = Schema.Struct({
  roundId: Schema.NullOr(Schema.String),
  name: Schema.String,
  opensAt: Schema.String,
  closesAt: Schema.String,
  blind: Schema.Boolean,
  position: Schema.Number,
  criteria: Schema.Array(ReviewCriterionSave),
});

const MemberBody = Schema.Struct({
  email: Schema.String,
  assignmentCap: Schema.NullOr(Schema.Number),
  accessPath: Schema.String,
});

const AssignBody = Schema.Struct({
  eventMemberId: Schema.String,
  submissionIds: Schema.Array(Schema.String),
});

const AutoDistributeBody = Schema.Struct({ trackIds: Schema.Array(Schema.String) });
const RemindersBody = Schema.Struct({ eventMemberIds: Schema.Array(Schema.String) });
const AiReviewBody = Schema.Struct({ submissionId: Schema.String });
const AiOverrideBody = Schema.Struct({
  resultId: Schema.String,
  score: Schema.Number,
  reason: Schema.String,
});

export const reviewEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/evaluation",
    operationId: "getEvaluation",
    summary: "Get the evaluation workspace",
    description: "Every review round with criteria, reviewers, assignments, progress, and results.",
    tag: "Reviews",
    successSchema: EvaluationAdminWorkspace,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviews = yield* Reviews;
        return yield* reviews.adminWorkspace(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds",
    operationId: "saveReviewRound",
    summary: "Create or update a review round",
    description: "Pass roundId: null to create. Criteria replace the round's existing scorecard.",
    tag: "Reviews",
    bodySchema: RoundBody,
    successSchema: Schema.Struct({
      roundId: Schema.String,
      workspace: EvaluationAdminWorkspace,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof RoundBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const eventId = access.event.id;
        if (body.roundId !== null) yield* requireRound(eventId, body.roundId);
        const name = body.name.trim();
        if (name.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Name this review round" }));
        }
        if (!Number.isInteger(body.position) || body.position < 1) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Round position must be a whole number of at least 1" }),
          );
        }
        const [opensAt, closesAt, criteria] = yield* Effect.all([
          dateOrFail(body.opensAt, "opensAt"),
          dateOrFail(body.closesAt, "closesAt"),
          normalizeCriteria(body.criteria),
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
          id: body.roundId,
          eventId,
          name,
          opensAt,
          closesAt,
          blind: body.blind,
          position: body.position,
          status,
        });
        yield* reviews.saveCriteria(round.id, criteria);
        const workspace = yield* reviews.adminWorkspace(eventId);
        return { roundId: round.id, workspace };
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds/{roundId}/members",
    operationId: "addReviewer",
    summary: "Add a reviewer to a round",
    description:
      "Provisions the reviewer (inviting them by email if they have no account) and emails their access path.",
    tag: "Reviews",
    bodySchema: MemberBody,
    successStatus: 201,
    successSchema: ReviewerProvisioned,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof MemberBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        if (
          body.assignmentCap !== null &&
          (!Number.isInteger(body.assignmentCap) || body.assignmentCap < 1)
        ) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Assignment cap must be a whole number of at least 1" }),
          );
        }
        const reviews = yield* Reviews;
        const mail = yield* Mail;
        const provisioned = yield* reviews.provisionMember({
          roundId,
          email: body.email,
          assignmentCap: body.assignmentCap,
          accessPath: body.accessPath,
        });
        if (provisioned.invitationLogId !== null) {
          yield* mail.sendQueued(provisioned.invitationLogId);
        }
        return provisioned;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds/{roundId}/assignments",
    operationId: "assignReviews",
    summary: "Assign submissions to a reviewer",
    tag: "Reviews",
    bodySchema: AssignBody,
    successSchema: Schema.Struct({
      created: Schema.Number,
      skipped: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AssignBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        const reviews = yield* Reviews;
        const submissionIds = Array.from(new Set(body.submissionIds));
        const assignments = yield* Effect.forEach(
          submissionIds,
          (submissionId) => reviews.assign(roundId, submissionId, body.eventMemberId),
          { concurrency: 1 },
        );
        const created = assignments.filter((assignment) => assignment.created).length;
        return { created, skipped: assignments.length - created };
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds/{roundId}/auto-distribute",
    operationId: "autoDistributeReviews",
    summary: "Auto-distribute submissions across reviewers",
    description:
      "Balances open submissions across the round's reviewers, honoring assignment caps and track scopes.",
    tag: "Reviews",
    bodySchema: AutoDistributeBody,
    successSchema: Schema.Struct({
      created: Schema.Number,
      skipped: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AutoDistributeBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        const reviews = yield* Reviews;
        const result = yield* reviews.autoDistribute(roundId, body.trackIds);
        return { created: result.assignments.length, skipped: result.skipped };
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/events/{eventId}/review-rounds/{roundId}/assignments/{assignmentId}",
    operationId: "unassignReview",
    summary: "Remove a review assignment",
    tag: "Reviews",
    successStatus: 204,
    successSchema: Schema.Null,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        const reviews = yield* Reviews;
        yield* reviews.unassign(roundId, context.params.assignmentId ?? "");
        return null;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds/{roundId}/reminders",
    operationId: "sendReviewReminders",
    summary: "Send reviewer reminders",
    tag: "Reviews",
    bodySchema: RemindersBody,
    successSchema: Schema.Struct({
      queued: Schema.Number,
      sent: Schema.Number,
      failed: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof RemindersBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        const reviews = yield* Reviews;
        const mail = yield* Mail;
        const reminders = yield* reviews.queueReminders(roundId, body.eventMemberIds);
        const deliveries = yield* Effect.forEach(
          reminders,
          (reminder) => mail.sendQueued(reminder.logId),
          { concurrency: 5 },
        );
        return {
          queued: reminders.length,
          sent: deliveries.filter(
            (delivery) => delivery.status === "sent" || delivery.status === "demo",
          ).length,
          failed: deliveries.filter((delivery) => delivery.status === "failed").length,
        };
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/review-rounds/{roundId}/ai-review",
    operationId: "generateAiReview",
    summary: "Generate an AI review",
    description:
      "Runs the Anthropic-backed scorecard review for one submission. Requires ANTHROPIC_API_KEY on the deployment.",
    tag: "Reviews",
    bodySchema: AiReviewBody,
    successSchema: AiReviewResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AiReviewBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const roundId = context.params.roundId ?? "";
        yield* requireRound(access.event.id, roundId);
        const reviews = yield* Reviews;
        return yield* reviews.generateAiResult(roundId, body.submissionId);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/ai-review-override",
    operationId: "overrideAiReview",
    summary: "Override an AI review score",
    tag: "Reviews",
    bodySchema: AiOverrideBody,
    successSchema: AiReviewResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AiOverrideBody.Type;
        yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (!Number.isFinite(body.score)) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a valid override score" }));
        }
        const reviews = yield* Reviews;
        return yield* reviews.overrideAiResult(body.resultId, body.score, body.reason, {
          kind: "api_key",
          apiKeyId: context.principal.keyId,
          name: `API key: ${context.principal.keyName}`,
        });
      }),
  }),
];
