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
  reviewsPerSubmission: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 })),
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

export const AutoDistributionTier = Schema.Literals(["in_track", "generalist", "out_of_track"]);
export type AutoDistributionTier = typeof AutoDistributionTier.Type;
export const AutoDistributionPlanItem = Schema.Struct({
  submissionId: Schema.String,
  eventMemberId: Schema.String,
  tier: AutoDistributionTier,
});
export type AutoDistributionPlanItem = typeof AutoDistributionPlanItem.Type;
export const AutoDistributionShortfallReason = Schema.Literals([
  "caps_exhausted",
  "conflicts",
  "no_reviewers",
]);
export const AutoDistributionShortfall = Schema.Struct({
  submissionId: Schema.String,
  code: Schema.String,
  missing: Schema.Number,
  reason: AutoDistributionShortfallReason,
});
export type AutoDistributionShortfall = typeof AutoDistributionShortfall.Type;

export const ReviewAssignmentBatch = Schema.Struct({
  planned: Schema.Array(AutoDistributionPlanItem),
  created: Schema.Number,
  skipped: Schema.Number,
  outOfTrack: Schema.Number,
  conflictsSkipped: Schema.Number,
  shortfalls: Schema.Array(AutoDistributionShortfall),
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
  overriddenByUserId: NullableString,
  overriddenByApiKeyId: NullableString,
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

// contactId/headshotUrl feed the standard speaker badge; both stay null on
// blind rounds where the reviewer view must not expose identity.
export const EvaluationParticipant = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
  contactId: NullableString,
  headshotUrl: NullableString,
});
export type EvaluationParticipant = typeof EvaluationParticipant.Type;

export const EvaluationSubmission = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  status: SubmissionStatus,
  submittedAt: Schema.Date,
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
  tracks: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String, color: Schema.String }),
  ),
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
  reviewsPerSubmission: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 })),
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
  dryRun: Schema.optionalKey(Schema.Boolean),
});
export const ListReviewerTracksRequest = Schema.Struct({ eventId: Schema.String });
export const SetReviewerTracksRequest = Schema.Struct({
  eventId: Schema.String,
  eventMemberId: Schema.String,
  trackIds: Schema.Array(Schema.String),
  roundId: Schema.optionalKey(Schema.String),
  assignmentCap: Schema.optionalKey(NullableNumber),
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
  readonly trackIds: ReadonlyArray<string>;
  readonly conflictedSubmissionIds: ReadonlyArray<string>;
}

export interface AutoDistributionAssignment {
  readonly submissionId: string;
  readonly eventMemberId: string;
  readonly status: ReviewAssignmentStatus;
}

export const planAutoDistribution = (input: {
  readonly submissions: ReadonlyArray<{
    readonly id: string;
    readonly code: string;
    readonly trackIds: ReadonlyArray<string>;
  }>;
  readonly members: ReadonlyArray<AutoDistributionMember>;
  readonly existing: ReadonlyArray<AutoDistributionAssignment>;
  readonly reviewsPerSubmission: number;
}) => {
  const existingKeys = new Set(
    input.existing.map(({ submissionId, eventMemberId }) => `${submissionId}:${eventMemberId}`),
  );
  const assignmentCounts = new Map<string, number>();
  const reviewCounts = new Map<string, number>();
  for (const assignment of input.existing) {
    if (assignment.status === "recused") continue;
    assignmentCounts.set(
      assignment.eventMemberId,
      (assignmentCounts.get(assignment.eventMemberId) ?? 0) + 1,
    );
    reviewCounts.set(assignment.submissionId, (reviewCounts.get(assignment.submissionId) ?? 0) + 1);
  }
  const submissions = Array.from(
    new Map(input.submissions.map((submission) => [submission.id, submission])).values(),
  ).sort((left, right) => {
    const countDifference = (reviewCounts.get(left.id) ?? 0) - (reviewCounts.get(right.id) ?? 0);
    return countDifference || left.id.localeCompare(right.id);
  });
  const members = Array.from(
    new Map(input.members.map((member) => [member.eventMemberId, member])).values(),
  ).sort((left, right) => left.eventMemberId.localeCompare(right.eventMemberId));
  const planned: Array<AutoDistributionPlanItem> = [];
  const conflictKeys = new Set<string>();
  const tierOrder = { in_track: 1, generalist: 2, out_of_track: 3 } as const;
  const tierFor = (
    member: AutoDistributionMember,
    submissionTrackIds: ReadonlySet<string>,
  ): AutoDistributionTier => {
    if (member.trackIds.some((trackId) => submissionTrackIds.has(trackId))) return "in_track";
    return member.trackIds.length === 0 ? "generalist" : "out_of_track";
  };

  for (let level = 1; level <= input.reviewsPerSubmission; level += 1) {
    for (const submission of submissions) {
      if ((reviewCounts.get(submission.id) ?? 0) >= level) continue;
      const submissionTracks = new Set(submission.trackIds);
      const candidates = members
        .flatMap((member) => {
          const key = `${submission.id}:${member.eventMemberId}`;
          if (existingKeys.has(key)) return [];
          if (member.conflictedSubmissionIds.includes(submission.id)) {
            conflictKeys.add(key);
            return [];
          }
          const load = assignmentCounts.get(member.eventMemberId) ?? 0;
          if (member.assignmentCap !== null && load >= member.assignmentCap) return [];
          return [{ member, load, tier: tierFor(member, submissionTracks) }];
        })
        .sort((left, right) => {
          return (
            tierOrder[left.tier] - tierOrder[right.tier] ||
            left.load - right.load ||
            left.member.eventMemberId.localeCompare(right.member.eventMemberId)
          );
        });
      const candidate = candidates[0];
      if (candidate === undefined) continue;
      planned.push({
        submissionId: submission.id,
        eventMemberId: candidate.member.eventMemberId,
        tier: candidate.tier,
      });
      existingKeys.add(`${submission.id}:${candidate.member.eventMemberId}`);
      assignmentCounts.set(candidate.member.eventMemberId, candidate.load + 1);
      reviewCounts.set(submission.id, (reviewCounts.get(submission.id) ?? 0) + 1);
    }
  }

  const shortfalls: Array<AutoDistributionShortfall> = submissions.flatMap((submission) => {
    const missing = Math.max(
      0,
      input.reviewsPerSubmission - (reviewCounts.get(submission.id) ?? 0),
    );
    if (missing === 0) return [];
    const unassigned = members.filter(
      (member) => !existingKeys.has(`${submission.id}:${member.eventMemberId}`),
    );
    const reason =
      unassigned.length === 0
        ? "no_reviewers"
        : unassigned.every((member) => member.conflictedSubmissionIds.includes(submission.id))
          ? "conflicts"
          : "caps_exhausted";
    return [{ submissionId: submission.id, code: submission.code, missing, reason }];
  });

  return {
    planned,
    stats: {
      outOfTrack: planned.filter((assignment) => assignment.tier === "out_of_track").length,
      conflictsSkipped: conflictKeys.size,
    },
    shortfalls,
  };
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
  userId: string,
  now: Date,
): AiReviewResult => ({
  ...result,
  overriddenScore: score,
  overrideReason: reason,
  overriddenByUserId: userId,
  overriddenAt: now,
  updatedAt: now,
});
