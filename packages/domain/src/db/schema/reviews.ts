import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import {
  id,
  reviewAssignmentStatus,
  reviewCriterionType,
  reviewRoundStatus,
  timestamps,
} from "../columns";
import { eventMembers, events } from "./core";
import { users } from "./identity";
import { apiKeys } from "./integrations";
import { submissions } from "./submissions";

export const reviewRounds = pgTable(
  "review_rounds",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    blind: boolean("blind").notNull().default(false),
    position: integer("position").notNull(),
    status: reviewRoundStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    unique("review_rounds_event_name_unique").on(table.eventId, table.name),
    index("review_rounds_event_position_idx").on(table.eventId, table.position),
  ],
);

export const reviewCriteria = pgTable(
  "review_criteria",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => reviewRounds.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: reviewCriterionType("type").notNull(),
    min: doublePrecision("min"),
    max: doublePrecision("max"),
    options: jsonb("options").$type<ReadonlyArray<string>>().notNull().default([]),
    required: boolean("required").notNull().default(false),
    weight: doublePrecision("weight").notNull().default(1),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("review_criteria_round_label_unique").on(table.roundId, table.label),
    index("review_criteria_round_position_idx").on(table.roundId, table.position),
  ],
);

export const reviewRoundMembers = pgTable(
  "review_round_members",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => reviewRounds.id, { onDelete: "cascade" }),
    eventMemberId: text("event_member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    assignmentCap: integer("assignment_cap"),
    ...timestamps,
  },
  (table) => [
    unique("review_round_members_round_member_unique").on(table.roundId, table.eventMemberId),
    index("review_round_members_member_idx").on(table.eventMemberId),
  ],
);

export const reviewAssignments = pgTable(
  "review_assignments",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => reviewRounds.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    eventMemberId: text("event_member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    status: reviewAssignmentStatus("status").notNull().default("pending"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recusedAt: timestamp("recused_at", { withTimezone: true }),
    recusalReason: text("recusal_reason"),
    ...timestamps,
  },
  (table) => [
    unique("review_assignments_round_submission_member_unique").on(
      table.roundId,
      table.submissionId,
      table.eventMemberId,
    ),
    index("review_assignments_round_member_idx").on(table.roundId, table.eventMemberId),
    index("review_assignments_submission_idx").on(table.submissionId),
  ],
);

export const reviewAnswers = pgTable(
  "review_answers",
  {
    id: id(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => reviewAssignments.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id")
      .notNull()
      .references(() => reviewCriteria.id, { onDelete: "cascade" }),
    numericValue: doublePrecision("numeric_value"),
    textValue: text("text_value"),
    optionValue: text("option_value"),
    ...timestamps,
  },
  (table) => [
    unique("review_answers_assignment_criterion_unique").on(table.assignmentId, table.criterionId),
    index("review_answers_criterion_idx").on(table.criterionId),
  ],
);

export const aiReviewResults = pgTable(
  "ai_review_results",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => reviewRounds.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull(),
    reasoning: text("reasoning").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    overriddenScore: doublePrecision("overridden_score"),
    overrideReason: text("override_reason"),
    overriddenByUserId: text("overridden_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    overriddenByApiKeyId: text("overridden_by_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamps.createdAt,
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    unique("ai_review_results_round_submission_unique").on(table.roundId, table.submissionId),
    index("ai_review_results_submission_idx").on(table.submissionId),
  ],
);
