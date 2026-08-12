import { nanoid } from "nanoid";
import { pgEnum, text, timestamp } from "drizzle-orm/pg-core";

export const id = () => text("id").primaryKey().$defaultFn(nanoid);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const eventMemberRole = pgEnum("event_member_role", ["admin", "reviewer"]);
export const formStatus = pgEnum("form_status", ["open", "closed"]);
export const formSection = pgEnum("form_section", ["abstract", "participant"]);
export const formFieldType = pgEnum("form_field_type", [
  "text",
  "textarea",
  "richtext",
  "email",
  "phone",
  "dropdown",
  "checkbox",
  "file",
  "datetime",
]);
export const targetType = pgEnum("target_type", ["contact", "submission"]);
export const taskStatus = pgEnum("task_status", ["todo", "done", "waived"]);
export const deliverableStatus = pgEnum("deliverable_status", ["outstanding", "uploaded"]);
export const fileKind = pgEnum("file_kind", ["request", "headshot", "slides"]);
export const contentApprovalStatus = pgEnum("content_approval_status", [
  "approved",
  "pending_review",
  "rejected",
]);
export const dietaryRequirement = pgEnum("dietary_requirement", [
  "none",
  "vegetarian",
  "vegan",
  "gluten_free",
  "other",
]);
export const tshirtSize = pgEnum("tshirt_size", ["XS", "S", "M", "L", "XL", "XXL"]);
export const emailType = pgEnum("email_type", [
  "confirmation",
  "magic_link",
  "accepted",
  "declined",
  "cancelled",
  "reinstated",
  "task_reminder",
  "calendar_invite",
  "custom",
]);
export const emailStatus = pgEnum("email_status", ["queued", "demo", "sent", "failed"]);
export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "pending",
  "maybe",
  "accepted",
  "declined",
  "withdrawn",
]);
// Cancellation is a session lifecycle event, not an acceptance decision: the
// submission stays "accepted" as historical fact, and the cause records who
// pulled out. "Declined"/"withdrawn" are strictly pre-acceptance exits.
export const sessionCancelledBy = pgEnum("session_cancelled_by", ["organizer", "speaker"]);
// Append-only log of the lifecycle transitions that would otherwise be lossy
// (columns overwritten in place). Events with their own durable record —
// emails, edit history, file versions, task completions — are NOT dual-written
// here; the timeline read model merges all sources.
export const submissionActivityType = pgEnum("submission_activity_type", [
  "status_changed",
  "decided",
  "cancelled",
  "reinstated",
  "scheduled",
  "content_approved",
]);
export const agendaDraftStatus = pgEnum("agenda_draft_status", [
  "draft",
  "generated",
  "committed",
  "discarded",
]);
export const reviewDecision = pgEnum("review_decision", ["approve", "maybe", "deny"]);
export const reviewRoundStatus = pgEnum("review_round_status", ["draft", "open", "closed"]);
export const reviewCriterionType = pgEnum("review_criterion_type", ["numeric", "dropdown", "text"]);
export const reviewAssignmentStatus = pgEnum("review_assignment_status", [
  "pending",
  "completed",
  "recused",
]);
export const speakerWorkflowStatus = pgEnum("speaker_workflow_status", [
  "invited",
  "onboarding",
  "confirmed",
  "ready",
  "declined",
]);
export const emailCampaignStatus = pgEnum("email_campaign_status", ["draft", "sending", "sent"]);
export const campaignDeliveryStatus = pgEnum("campaign_delivery_status", [
  "pending",
  "sent",
  "failed",
]);
export const crmSemanticStatus = pgEnum("crm_semantic_status", ["open", "won", "lost"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "canceled",
]);
export const embedView = pgEnum("embed_view", [
  "sessions",
  "speakers",
  "speaker_gallery",
  "agenda",
  "itinerary",
]);
