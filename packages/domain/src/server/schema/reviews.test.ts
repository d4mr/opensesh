import { describe, expect, it } from "vitest";

import type { AiReviewResult, ReviewAssignment, ReviewCriterion } from "./reviews";
import {
  overrideAiScore,
  planAutoDistribution,
  recuseAssignment,
  redactBlindSubmission,
  validateReviewAnswer,
  validateRequiredReviewAnswer,
  weightedAggregate,
} from "./reviews";

const now = new Date("2026-08-10T12:00:00.000Z");
const criterion = (input: Partial<ReviewCriterion>): ReviewCriterion => ({
  id: "criterion",
  roundId: "round",
  label: "Score",
  type: "numeric",
  min: 1,
  max: 5,
  options: [],
  required: true,
  weight: 1,
  position: 1,
  createdAt: now,
  updatedAt: now,
  ...input,
});

describe("review domain", () => {
  it("returns 3.33 for Originality 4 × 2 and Relevance 2 × 1", () => {
    expect(
      weightedAggregate([
        { value: 4, weight: 2 },
        { value: 2, weight: 1 },
      ]),
    ).toBe(3.33);
  });

  it("rejects numeric values outside criterion bounds", () => {
    const error = validateReviewAnswer(criterion({ label: "Originality" }), {
      numericValue: 6,
      optionValue: null,
    });

    expect(error?._tag).toBe("NumericOutOfBounds");
  });

  it("rejects dropdown values outside configured options", () => {
    const error = validateReviewAnswer(
      criterion({
        label: "Recommendation",
        type: "dropdown",
        min: null,
        max: null,
        options: ["Accept", "Maybe", "Reject"],
      }),
      { numericValue: null, optionValue: "Revise" },
    );

    expect(error?._tag).toBe("DropdownValueNotInOptions");
  });

  it("rejects a missing required answer", () => {
    const error = validateRequiredReviewAnswer(criterion({ label: "Originality" }), undefined);

    expect(error?._tag).toBe("InvalidInput");
  });

  it("honors assignment caps during deterministic auto-distribution", () => {
    const planned = planAutoDistribution({
      submissionIds: ["s3", "s1", "s2"],
      members: [{ eventMemberId: "sam", assignmentCap: 2 }],
      existing: [],
    });

    expect(planned).toEqual([
      { submissionId: "s1", eventMemberId: "sam" },
      { submissionId: "s2", eventMemberId: "sam" },
    ]);
  });

  it("never duplicates an existing assignment", () => {
    const planned = planAutoDistribution({
      submissionIds: ["s1", "s1", "s2"],
      members: [
        { eventMemberId: "reviewer-a", assignmentCap: 2 },
        { eventMemberId: "reviewer-b", assignmentCap: 2 },
      ],
      existing: [{ submissionId: "s1", eventMemberId: "reviewer-a" }],
    });

    expect(planned).not.toContainEqual({ submissionId: "s1", eventMemberId: "reviewer-a" });
    expect(new Set(planned.map((item) => `${item.submissionId}:${item.eventMemberId}`)).size).toBe(
      planned.length,
    );
  });

  it("removes every identity field from a blind submission", () => {
    const blind = redactBlindSubmission({
      code: "SESS-1",
      title: "Taming CI with Priya Raman",
      description: "Build tooling lessons from Latticework Systems.",
      speakerNames: ["Priya Raman", "Marcus Okafor"],
      companies: ["Latticework Systems"],
      submitterEmail: "priya.speaker@sbek-test.example.com",
    });

    expect(blind).toEqual({
      code: "SESS-1",
      title: "Taming CI with [redacted]",
      description: "Build tooling lessons from [redacted].",
    });
    expect(JSON.stringify(blind)).not.toMatch(/Priya|Marcus|Latticework|@/);
  });

  it("changes a pending assignment to recused and rejects a second recusal", () => {
    const assignment: ReviewAssignment = {
      id: "assignment",
      roundId: "round",
      submissionId: "submission",
      eventMemberId: "sam",
      status: "pending",
      assignedAt: now,
      completedAt: null,
      recusedAt: null,
      recusalReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const recused = recuseAssignment(assignment, "Conflict of interest", now);

    expect("_tag" in recused).toBe(false);
    if ("_tag" in recused) return;
    expect(recused.status).toBe("recused");
    expect(recused.recusalReason).toBe("Conflict of interest");
    const second = recuseAssignment(recused, "Again", now);
    expect("_tag" in second ? second._tag : undefined).toBe("AlreadyRecused");
  });

  it("preserves the original AI score when overridden", () => {
    const result: AiReviewResult = {
      id: "ai-result",
      roundId: "round",
      submissionId: "submission",
      score: 4.2,
      reasoning: "Strong evidence.",
      provider: "anthropic",
      model: "fixture-model",
      overriddenScore: null,
      overrideReason: null,
      overriddenByUserId: null,
      overriddenByApiKeyId: null,
      overriddenAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const overridden = overrideAiScore(result, 3.5, "Needs more novelty", "jordan", now);

    expect(overridden.score).toBe(4.2);
    expect(overridden.overriddenScore).toBe(3.5);
    expect(overridden.overrideReason).toBe("Needs more novelty");
    expect(overridden.overriddenByUserId).toBe("jordan");
  });
});
