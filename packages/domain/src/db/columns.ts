import { nanoid } from "nanoid";
import { text, timestamp } from "drizzle-orm/pg-core";

export const id = () => text("id").primaryKey().$defaultFn(nanoid);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
};

// Constrained text columns, deliberately NOT Postgres enum types. The domain
// layer's Effect Schema literals are the authority on legal values; pg enums
// duplicated that fact in DDL and made every value addition a hand-run prod
// `ALTER TYPE ADD VALUE` event (missing-value drift once broke the prod mail
// queue). Drizzle's enum option keeps the compile-time literal union; the
// database stores plain text.
const textEnum =
  <const Values extends readonly [string, ...string[]]>(values: Values) =>
  (name: string) =>
    text(name, { enum: values });

export const eventMemberRole = textEnum(["admin", "reviewer"]);
export const formStatus = textEnum(["open", "closed"]);
export const formSection = textEnum(["abstract", "participant"]);
export const formFieldType = textEnum([
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
export const targetType = textEnum(["contact", "submission"]);
export const taskStatus = textEnum(["todo", "done", "waived"]);
export const deliverableStatus = textEnum(["outstanding", "uploaded"]);
export const fileKind = textEnum(["request", "headshot", "slides"]);
export const contentApprovalStatus = textEnum(["approved", "pending_review", "rejected"]);
export const dietaryRequirement = textEnum(["none", "vegetarian", "vegan", "gluten_free", "other"]);
export const tshirtSize = textEnum(["XS", "S", "M", "L", "XL", "XXL"]);
export const emailType = textEnum([
  "confirmation",
  "magic_link",
  "accepted",
  "declined",
  "cancelled",
  "reinstated",
  "task_reminder",
  "calendar_invite",
  "portal_invitation",
  "custom",
]);
export const emailStatus = textEnum(["queued", "sending", "demo", "sent", "failed"]);
export const contactParticipation = textEnum(["submitter", "speaker", "organizer"]);
export const submissionStatus = textEnum([
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
export const sessionCancelledBy = textEnum(["organizer", "speaker"]);
// Append-only log of the lifecycle transitions that would otherwise be lossy
// (columns overwritten in place). Events with their own durable record —
// emails, edit history, file versions, task completions — are NOT dual-written
// here; the timeline read model merges all sources.
export const submissionActivityType = textEnum([
  "status_changed",
  "decided",
  "informed",
  "cancelled",
  "reinstated",
  "scheduled",
  "content_approved",
]);
export const agendaDraftStatus = textEnum(["draft", "generated", "committed", "discarded"]);
export const agendaBlockKind = textEnum(["break", "meal", "registration", "social", "other"]);
export const reviewDecision = textEnum(["approve", "maybe", "deny"]);
export const reviewRoundStatus = textEnum(["draft", "open", "closed"]);
export const reviewCriterionType = textEnum(["numeric", "dropdown", "text"]);
export const reviewAssignmentStatus = textEnum(["pending", "completed", "recused"]);
export const emailCampaignStatus = textEnum(["draft", "sending", "sent"]);
export const campaignDeliveryStatus = textEnum(["pending", "sent", "failed"]);
export const crmSemanticStatus = textEnum(["open", "won", "lost"]);
export const invitationStatus = textEnum(["pending", "accepted", "rejected", "canceled"]);
export const embedView = textEnum([
  "sessions",
  "speakers",
  "speaker_gallery",
  "agenda",
  "itinerary",
]);
export const resourceAudienceMode = textEnum(["all", "tracks", "contacts"]);
export const resourceAttachmentKind = textEnum(["link", "file", "embed"]);
