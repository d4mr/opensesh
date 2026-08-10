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
export const submissionKind = pgEnum("submission_kind", ["abstract", "session"]);
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
]);
export const targetType = pgEnum("target_type", ["contact", "submission"]);
export const taskStatus = pgEnum("task_status", ["todo", "done", "waived"]);
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
export const reviewDecision = pgEnum("review_decision", ["approve", "maybe", "deny"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "canceled",
]);
