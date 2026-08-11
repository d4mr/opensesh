import { Schema } from "effect";

import {
  AlreadyRecused,
  DropdownValueNotInOptions,
  InvalidInput,
  NumericOutOfBounds,
  RoundClosed,
} from "../errors";
import { EntityFields, JsonObject, NullableDate, NullableNumber, NullableString } from "./common";
import { SubmissionStatus } from "./submissions";

export const ReviewRoundStatus = Schema.Literals(["draft", "open", "closed"]);
export type ReviewRoundStatus = typeof ReviewRoundStatus.Type;
export const ReviewCriterionType = Schema.Literals(["numeric", "dropdown", "text"]);
export type ReviewCriterionType = typeof ReviewCriterionType.Type;
export const ReviewAssignmentStatus = Schema.Literals(["pending", "completed", "recused"]);
export type ReviewAssignmentStatus = typeof ReviewAssignmentStatus.Type;

const reviewRoundFields = {
  eventId: Schema.String,
  name: Schema.String,
  opensAt: Schema.Date,
  closesAt: Schema.Date,
  blind: Schema.Boolean,
  position: Schema.Number,
  status: ReviewRoundStatus,
};

export const ReviewRound = Schema.Struct({ ...EntityFields, ...reviewRoundFields });
export type ReviewRound = typeof ReviewRound.Type;
export const ReviewRoundSave = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  ...reviewRoundFields,
});
export type ReviewRoundSave = typeof ReviewRoundSave.Type;

const reviewCriterionFields = {
  roundId: Schema.String,
  label: Schema.String,
  type: ReviewCriterionType,
  min: NullableNumber,
  max: NullableNumber,
  options: Schema.Array(Schema.String),
  required: Schema.Boolean,
  weight: Schema.Number,
  position: Schema.Number,
};

export const ReviewCriterion = Schema.Struct({ ...EntityFields, ...reviewCriterionFields });
export type ReviewCriterion = typeof ReviewCriterion.Type;
export const ReviewCriterionSave = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  label: Schema.String,
  type: ReviewCriterionType,
  min: NullableNumber,
  max: NullableNumber,
  options: Schema.Array(Schema.String),
  required: Schema.Boolean,
  weight: Schema.Number,
  position: Schema.Number,
});
export type ReviewCriterionSave = typeof ReviewCriterionSave.Type;

export const ReviewRoundMember = Schema.Struct({
  ...EntityFields,
  roundId: Schema.String,
  eventMemberId: Schema.String,
  assignmentCap: NullableNumber,
});
export type ReviewRoundMember = typeof ReviewRoundMember.Type;

export const ReviewAssignment = Schema.Struct({
  ...EntityFields,
  roundId: Schema.String,
  submissionId: Schema.String,
  eventMemberId: Schema.String,
  status: ReviewAssignmentStatus,
  assignedAt: Schema.Date,
  completedAt: NullableDate,
  recusedAt: NullableDate,
  recusalReason: NullableString,
});
export type ReviewAssignment = typeof ReviewAssignment.Type;

export const ReviewAssignmentMutation = Schema.Struct({
  assignment: ReviewAssignment,
  created: Schema.Boolean,
});
export type ReviewAssignmentMutation = typeof ReviewAssignmentMutation.Type;

export const ReviewAssignmentBatch = Schema.Struct({
  assignments: Schema.Array(ReviewAssignment),
  skipped: Schema.Number,
});
export type ReviewAssignmentBatch = typeof ReviewAssignmentBatch.Type;

export const ReviewAnswer = Schema.Struct({
  ...EntityFields,
  assignmentId: Schema.String,
  criterionId: Schema.String,
  numericValue: NullableNumber,
  textValue: NullableString,
  optionValue: NullableString,
});
export type ReviewAnswer = typeof ReviewAnswer.Type;

export const ReviewAnswerInput = Schema.Struct({
  criterionId: Schema.String,
  numericValue: NullableNumber,
  textValue: NullableString,
  optionValue: NullableString,
});
export type ReviewAnswerInput = typeof ReviewAnswerInput.Type;

export const AiReviewResult = Schema.Struct({
  ...EntityFields,
  roundId: Schema.String,
  submissionId: Schema.String,
  score: Schema.Number,
  reasoning: Schema.String,
  provider: Schema.String,
  model: Schema.String,
  overriddenScore: NullableNumber,
  overrideReason: NullableString,
  overriddenByEventMemberId: NullableString,
  overriddenAt: NullableDate,
});
export type AiReviewResult = typeof AiReviewResult.Type;

export const ReviewRoundConfiguration = Schema.Struct({
  round: ReviewRound,
  criteria: Schema.Array(ReviewCriterion),
  members: Schema.Array(ReviewRoundMember),
});
export type ReviewRoundConfiguration = typeof ReviewRoundConfiguration.Type;

export const ReviewerQueueItem = Schema.Struct({
  assignment: ReviewAssignment,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: SubmissionStatus,
  trackNames: Schema.Array(Schema.String),
  answers: Schema.Array(ReviewAnswer),
});
export type ReviewerQueueItem = typeof ReviewerQueueItem.Type;

export const ReviewProgress = Schema.Struct({
  roundId: Schema.String,
  total: Schema.Number,
  completed: Schema.Number,
  recused: Schema.Number,
  required: Schema.Number,
});
export type ReviewProgress = typeof ReviewProgress.Type;

export const ReviewResult = Schema.Struct({
  submissionId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  speakerNames: Schema.Array(Schema.String),
  reviewerCount: Schema.Number,
  completedCount: Schema.Number,
  weightedAggregate: NullableNumber,
  aiResult: Schema.NullOr(AiReviewResult),
});
export type ReviewResult = typeof ReviewResult.Type;

export const EvaluationParticipant = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
});
export type EvaluationParticipant = typeof EvaluationParticipant.Type;

export const EvaluationSubmission = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: SubmissionStatus,
  trackIds: Schema.Array(Schema.String),
  trackNames: Schema.Array(Schema.String),
  participants: Schema.Array(EvaluationParticipant),
});
export type EvaluationSubmission = typeof EvaluationSubmission.Type;

export const EvaluationReviewer = Schema.Struct({
  member: ReviewRoundMember,
  name: Schema.String,
  email: Schema.String,
});
export type EvaluationReviewer = typeof EvaluationReviewer.Type;

export const ReviewProgressRow = Schema.Struct({
  eventMemberId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  assigned: Schema.Number,
  completed: Schema.Number,
  recused: Schema.Number,
  remaining: Schema.Number,
  percentage: Schema.Number,
});
export type ReviewProgressRow = typeof ReviewProgressRow.Type;

export const ReviewResultAnswer = Schema.Struct({
  criterionId: Schema.String,
  label: Schema.String,
  type: ReviewCriterionType,
  numericValue: NullableNumber,
  textValue: NullableString,
  optionValue: NullableString,
});
export type ReviewResultAnswer = typeof ReviewResultAnswer.Type;

export const HumanReviewResult = Schema.Struct({
  assignment: ReviewAssignment,
  reviewerName: Schema.String,
  reviewerEmail: Schema.String,
  answers: Schema.Array(ReviewResultAnswer),
});
export type HumanReviewResult = typeof HumanReviewResult.Type;

export const EvaluationResultRow = Schema.Struct({
  submission: EvaluationSubmission,
  humanReviews: Schema.Array(HumanReviewResult),
  reviewerCount: Schema.Number,
  completedCount: Schema.Number,
  weightedAggregate: NullableNumber,
  recommendation: NullableString,
  aiResult: Schema.NullOr(AiReviewResult),
  aiOverriddenByName: NullableString,
});
export type EvaluationResultRow = typeof EvaluationResultRow.Type;

export const ReviewRoundAdminView = Schema.Struct({
  configuration: ReviewRoundConfiguration,
  reviewers: Schema.Array(EvaluationReviewer),
  assignments: Schema.Array(ReviewAssignment),
  submissions: Schema.Array(EvaluationSubmission),
  progress: Schema.Array(ReviewProgressRow),
  results: Schema.Array(EvaluationResultRow),
});
export type ReviewRoundAdminView = typeof ReviewRoundAdminView.Type;

export const EvaluationAdminWorkspace = Schema.Struct({
  eventId: Schema.String,
  aiConfigured: Schema.Boolean,
  tracks: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
  rounds: Schema.Array(ReviewRoundAdminView),
});
export type EvaluationAdminWorkspace = typeof EvaluationAdminWorkspace.Type;

export const ReviewerQueueRound = Schema.Struct({
  round: ReviewRound,
  criteria: Schema.Array(ReviewCriterion),
  items: Schema.Array(
    Schema.Struct({
      assignment: ReviewAssignment,
      code: Schema.String,
      title: Schema.String,
      description: Schema.String,
      status: SubmissionStatus,
      trackNames: Schema.Array(Schema.String),
      participants: Schema.Array(EvaluationParticipant),
      answers: Schema.Array(ReviewAnswer),
    }),
  ),
  pending: Schema.Number,
  completed: Schema.Number,
  recused: Schema.Number,
});
export type ReviewerQueueRound = typeof ReviewerQueueRound.Type;

export const ReviewerWorkspace = Schema.Struct({
  eventId: Schema.String,
  eventMemberId: Schema.String,
  rounds: Schema.Array(ReviewerQueueRound),
});
export type ReviewerWorkspace = typeof ReviewerWorkspace.Type;

export const ReviewerProvisioned = Schema.Struct({
  reviewer: EvaluationReviewer,
  accessPath: Schema.String,
  alreadyInPool: Schema.Boolean,
  invitationLogged: Schema.Boolean,
  invitationLogId: NullableString,
});
export type ReviewerProvisioned = typeof ReviewerProvisioned.Type;

export const ReviewReminder = Schema.Struct({
  logId: Schema.String,
  recipient: Schema.String,
  pending: Schema.Number,
});
export type ReviewReminder = typeof ReviewReminder.Type;

export const EvaluationEventRequest = Schema.Struct({ eventId: Schema.String });
export const EvaluationRoundRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
});
export const SaveReviewRoundRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.NullOr(Schema.String),
  name: Schema.String,
  opensAt: Schema.String,
  closesAt: Schema.String,
  blind: Schema.Boolean,
  position: Schema.Number,
  criteria: Schema.Array(ReviewCriterionSave),
});
export const AddReviewMemberRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  email: Schema.String,
  assignmentCap: NullableNumber,
  accessPath: Schema.String,
});
export const AssignReviewsRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  eventMemberId: Schema.String,
  submissionIds: Schema.Array(Schema.String),
});
export const AutoDistributeReviewsRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  trackIds: Schema.Array(Schema.String),
});
export const UnassignReviewRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  assignmentId: Schema.String,
});
export const SubmitReviewAnswersRequest = Schema.Struct({
  eventId: Schema.String,
  assignmentId: Schema.String,
  answers: Schema.Array(ReviewAnswerInput),
});
export const RecuseReviewRequest = Schema.Struct({
  eventId: Schema.String,
  assignmentId: Schema.String,
  reason: Schema.String,
});
export const SendReviewRemindersRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  eventMemberIds: Schema.Array(Schema.String),
});
export const GenerateAiReviewRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
  submissionId: Schema.String,
});
export const OverrideAiReviewRequest = Schema.Struct({
  eventId: Schema.String,
  resultId: Schema.String,
  score: Schema.Number,
  reason: Schema.String,
});
export const ExportReviewResultsRequest = Schema.Struct({
  eventId: Schema.String,
  roundId: Schema.String,
});

export const ReviewCampaignFilter = JsonObject;

export interface WeightedScore {
  readonly value: number;
  readonly weight: number;
}

export const weightedAggregate = (scores: ReadonlyArray<WeightedScore>) => {
  const weighted = scores.reduce((sum, score) => sum + score.value * score.weight, 0);
  const weights = scores.reduce((sum, score) => sum + score.weight, 0);
  return weights === 0 ? null : Math.round((weighted / weights) * 100) / 100;
};

export const validateReviewAnswer = (
  criterion: Pick<ReviewCriterion, "label" | "type" | "min" | "max" | "options">,
  answer: Pick<ReviewAnswerInput, "numericValue" | "optionValue">,
): NumericOutOfBounds | DropdownValueNotInOptions | undefined => {
  if (
    criterion.type === "numeric" &&
    answer.numericValue !== null &&
    ((criterion.min !== null && answer.numericValue < criterion.min) ||
      (criterion.max !== null && answer.numericValue > criterion.max))
  ) {
    return new NumericOutOfBounds({ message: `${criterion.label} is outside its allowed range` });
  }
  if (
    criterion.type === "dropdown" &&
    answer.optionValue !== null &&
    !criterion.options.includes(answer.optionValue)
  ) {
    return new DropdownValueNotInOptions({
      message: `${answer.optionValue} is not an option for ${criterion.label}`,
    });
  }
  return undefined;
};

export const validateRequiredReviewAnswer = (
  criterion: Pick<ReviewCriterion, "label" | "type" | "required">,
  answer: ReviewAnswerInput | undefined,
): InvalidInput | undefined => {
  if (!criterion.required) return undefined;
  const present =
    answer !== undefined &&
    (criterion.type === "numeric"
      ? answer.numericValue !== null
      : criterion.type === "dropdown"
        ? answer.optionValue !== null && answer.optionValue.trim().length > 0
        : answer.textValue !== null && answer.textValue.trim().length > 0);
  return present ? undefined : new InvalidInput({ message: `${criterion.label} is required` });
};

export const ensureRoundOpen = (
  round: Pick<ReviewRound, "status" | "opensAt" | "closesAt">,
  now: Date,
) =>
  round.status !== "open" || now < round.opensAt || now > round.closesAt
    ? new RoundClosed({ message: "This review round is closed" })
    : undefined;

export interface AutoDistributionMember {
  readonly eventMemberId: string;
  readonly assignmentCap: number | null;
}

export interface AutoDistributionAssignment {
  readonly submissionId: string;
  readonly eventMemberId: string;
}

export const planAutoDistribution = (input: {
  readonly submissionIds: ReadonlyArray<string>;
  readonly members: ReadonlyArray<AutoDistributionMember>;
  readonly existing: ReadonlyArray<AutoDistributionAssignment>;
}) => {
  const members = [...input.members].sort((left, right) =>
    left.eventMemberId.localeCompare(right.eventMemberId),
  );
  const submissions = [...new Set(input.submissionIds)].sort();
  const existingKeys = new Set(
    input.existing.map((item) => `${item.submissionId}:${item.eventMemberId}`),
  );
  const counts = new Map<string, number>();
  for (const assignment of input.existing) {
    counts.set(assignment.eventMemberId, (counts.get(assignment.eventMemberId) ?? 0) + 1);
  }
  const planned: Array<AutoDistributionAssignment> = [];
  for (const submissionId of submissions) {
    const member = members.find((candidate) => {
      const count = counts.get(candidate.eventMemberId) ?? 0;
      return (
        !existingKeys.has(`${submissionId}:${candidate.eventMemberId}`) &&
        (candidate.assignmentCap === null || count < candidate.assignmentCap)
      );
    });
    if (member === undefined) continue;
    planned.push({ submissionId, eventMemberId: member.eventMemberId });
    existingKeys.add(`${submissionId}:${member.eventMemberId}`);
    counts.set(member.eventMemberId, (counts.get(member.eventMemberId) ?? 0) + 1);
    members.sort((left, right) => {
      const countDifference =
        (counts.get(left.eventMemberId) ?? 0) - (counts.get(right.eventMemberId) ?? 0);
      return countDifference || left.eventMemberId.localeCompare(right.eventMemberId);
    });
  }
  return planned;
};

export const redactBlindSubmission = (input: {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly speakerNames: ReadonlyArray<string>;
  readonly companies: ReadonlyArray<string>;
  readonly submitterEmail: string | null;
}) => {
  const identityValues = [
    ...input.speakerNames,
    ...input.companies,
    ...(input.submitterEmail === null ? [] : [input.submitterEmail]),
  ].filter((value) => value.trim().length > 0);
  const redact = (value: string) =>
    identityValues.reduce(
      (current, identity) =>
        current.replaceAll(new RegExp(escapeRegExp(identity), "gi"), "[redacted]"),
      value,
    );
  return { code: input.code, title: redact(input.title), description: redact(input.description) };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const recuseAssignment = (
  assignment: ReviewAssignment,
  reason: string,
  now: Date,
): ReviewAssignment | AlreadyRecused =>
  assignment.status === "recused"
    ? new AlreadyRecused({ message: "This assignment is already recused" })
    : {
        ...assignment,
        status: "recused",
        recusedAt: now,
        recusalReason: reason,
        completedAt: null,
        updatedAt: now,
      };

export const overrideAiScore = (
  result: AiReviewResult,
  score: number,
  reason: string,
  eventMemberId: string,
  now: Date,
): AiReviewResult => ({
  ...result,
  overriddenScore: score,
  overrideReason: reason,
  overriddenByEventMemberId: eventMemberId,
  overriddenAt: now,
  updatedAt: now,
});
