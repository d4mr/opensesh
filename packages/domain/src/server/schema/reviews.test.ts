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

  const submission = (id: string, trackIds: ReadonlyArray<string> = ["track-a"]) => ({
    id,
    code: id.toUpperCase(),
    trackIds,
  });
  const member = (
    eventMemberId: string,
    input: {
      readonly cap?: number | null;
      readonly trackIds?: ReadonlyArray<string>;
      readonly conflicts?: ReadonlyArray<string>;
    } = {},
  ) => ({
    eventMemberId,
    assignmentCap: input.cap ?? null,
    trackIds: input.trackIds ?? [],
    conflictedSubmissionIds: input.conflicts ?? [],
  });
  const existing = (
    submissionId: string,
    eventMemberId: string,
    status: "pending" | "completed" | "recused" = "pending",
  ) => ({ submissionId, eventMemberId, status });

  it("fills the configured quorum breadth-first", () => {
    const result = planAutoDistribution({
      submissions: [submission("s2"), submission("s1")],
      members: [member("reviewer-b"), member("reviewer-a")],
      existing: [],
      reviewsPerSubmission: 2,
    });

    expect(
      result.planned.map(({ submissionId, eventMemberId }) => ({
        submissionId,
        eventMemberId,
      })),
    ).toEqual([
      { submissionId: "s1", eventMemberId: "reviewer-a" },
      { submissionId: "s2", eventMemberId: "reviewer-b" },
      { submissionId: "s1", eventMemberId: "reviewer-b" },
      { submissionId: "s2", eventMemberId: "reviewer-a" },
    ]);
    expect(result.shortfalls).toEqual([]);
  });

  it("counts existing non-recused assignments toward quorum", () => {
    const result = planAutoDistribution({
      submissions: [submission("s1")],
      members: [member("reviewer-a"), member("reviewer-b"), member("reviewer-c")],
      existing: [
        existing("s1", "reviewer-a", "completed"),
        existing("s1", "reviewer-b", "recused"),
      ],
      reviewsPerSubmission: 2,
    });

    expect(result.planned).toEqual([
      { submissionId: "s1", eventMemberId: "reviewer-c", tier: "generalist" },
    ]);
  });

  it("prefers in-track reviewers, then generalists, then out-of-track reviewers", () => {
    const result = planAutoDistribution({
      submissions: [submission("s1", ["track-a"])],
      members: [
        member("out", { trackIds: ["track-b"] }),
        member("generalist"),
        member("match", { trackIds: ["track-a"] }),
      ],
      existing: [],
      reviewsPerSubmission: 3,
    });

    expect(result.planned.map((assignment) => assignment.eventMemberId)).toEqual([
      "match",
      "generalist",
      "out",
    ]);
    expect(result.stats.outOfTrack).toBe(1);
  });

  it("enforces assignment caps across existing and planned load", () => {
    const result = planAutoDistribution({
      submissions: [submission("s1"), submission("s2"), submission("s3")],
      members: [member("reviewer", { cap: 2 })],
      existing: [existing("outside", "reviewer")],
      reviewsPerSubmission: 1,
    });

    expect(result.planned).toHaveLength(1);
    expect(result.shortfalls).toEqual([
      { submissionId: "s2", code: "S2", missing: 1, reason: "caps_exhausted" },
      { submissionId: "s3", code: "S3", missing: 1, reason: "caps_exhausted" },
    ]);
  });

  it("never plans conflicts and counts each skipped pair once", () => {
    const result = planAutoDistribution({
      submissions: [submission("s1")],
      members: [member("speaker", { conflicts: ["s1"] })],
      existing: [],
      reviewsPerSubmission: 2,
    });

    expect(result.planned).toEqual([]);
    expect(result.stats.conflictsSkipped).toBe(1);
    expect(result.shortfalls).toEqual([
      { submissionId: "s1", code: "S1", missing: 2, reason: "conflicts" },
    ]);
  });

  it("spills over out of track only when earlier tiers cannot meet quorum", () => {
    const result = planAutoDistribution({
      submissions: [submission("s1", ["track-a"])],
      members: [
        member("match", { cap: 1, trackIds: ["track-a"] }),
        member("spill", { trackIds: ["track-b"] }),
      ],
      existing: [],
      reviewsPerSubmission: 2,
    });

    expect(result.planned).toEqual([
      { submissionId: "s1", eventMemberId: "match", tier: "in_track" },
      { submissionId: "s1", eventMemberId: "spill", tier: "out_of_track" },
    ]);
    expect(result.stats.outOfTrack).toBe(1);
  });

  it("distinguishes no-reviewer and cap-exhausted shortfalls", () => {
    const noReviewers = planAutoDistribution({
      submissions: [submission("s1")],
      members: [],
      existing: [],
      reviewsPerSubmission: 1,
    });
    const capped = planAutoDistribution({
      submissions: [submission("s1")],
      members: [member("reviewer", { cap: 1 })],
      existing: [existing("other", "reviewer")],
      reviewsPerSubmission: 1,
    });

    expect(noReviewers.shortfalls[0]?.reason).toBe("no_reviewers");
    expect(capped.shortfalls[0]?.reason).toBe("caps_exhausted");
  });

  it("is deterministic when submissions, members, tracks, and existing rows are shuffled", () => {
    const input = {
      submissions: [submission("s2", ["track-b"]), submission("s1", ["track-a"])],
      members: [
        member("reviewer-b", { trackIds: ["track-b", "track-a"] }),
        member("reviewer-a", { trackIds: ["track-a"] }),
      ],
      existing: [existing("s2", "reviewer-a")],
      reviewsPerSubmission: 2,
    } as const;
    const shuffled = {
      ...input,
      submissions: [...input.submissions].reverse().map((item) => ({
        ...item,
        trackIds: [...item.trackIds].reverse(),
      })),
      members: [...input.members].reverse().map((item) => ({
        ...item,
        trackIds: [...item.trackIds].reverse(),
      })),
      existing: [...input.existing].reverse(),
    };

    expect(planAutoDistribution(shuffled)).toEqual(planAutoDistribution(input));
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
