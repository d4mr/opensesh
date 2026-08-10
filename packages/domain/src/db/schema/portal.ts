import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "../columns";
import { events } from "./core";
import { contacts, submissions } from "./submissions";

export const portalForms = sqliteTable(
  "portal_forms",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    targetType: text("target_type", { enum: ["contact", "submission"] }).notNull(),
    sections: text("sections", { mode: "json" }).notNull(),
    confirmationEmailEnabled: integer("confirmation_email_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    confirmationEmailBody: text("confirmation_email_body"),
    ...timestamps,
  },
  (table) => [index("portal_forms_event_idx").on(table.eventId)],
);

export const portalFormResponses = sqliteTable(
  "portal_form_responses",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => portalForms.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    answers: text("answers", { mode: "json" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [index("portal_form_responses_form_idx").on(table.formId)],
);

export const fileRequests = sqliteTable(
  "file_requests",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetType: text("target_type", { enum: ["contact", "submission"] }).notNull(),
    instructions: text("instructions").notNull(),
    ...timestamps,
  },
  (table) => [index("file_requests_event_idx").on(table.eventId)],
);

export const fileUploads = sqliteTable(
  "file_uploads",
  {
    id: id(),
    fileRequestId: text("file_request_id")
      .notNull()
      .references(() => fileRequests.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    size: integer("size").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [index("file_uploads_request_idx").on(table.fileRequestId)],
);

export const taskTemplates = sqliteTable(
  "task_templates",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    scope: text("scope", { enum: ["contact", "submission"] }).notNull(),
    portalFormId: text("portal_form_id").references(() => portalForms.id, {
      onDelete: "set null",
    }),
    fileRequestId: text("file_request_id").references(() => fileRequests.id, {
      onDelete: "set null",
    }),
    autoAssignOnAccept: integer("auto_assign_on_accept", { mode: "boolean" })
      .notNull()
      .default(true),
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [index("task_templates_event_idx").on(table.eventId)],
);

export const taskAssignments = sqliteTable(
  "task_assignments",
  {
    id: id(),
    taskTemplateId: text("task_template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    status: text("status", { enum: ["todo", "done"] })
      .notNull()
      .default("todo"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("task_assignments_contact_idx").on(table.contactId),
    index("task_assignments_submission_idx").on(table.submissionId),
  ],
);

export const emailLog = sqliteTable(
  "email_log",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    type: text("type", {
      enum: [
        "confirmation",
        "magic_link",
        "accepted",
        "declined",
        "task_reminder",
        "calendar_invite",
        "custom",
      ],
    }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    icsAttached: integer("ics_attached", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["queued", "sent", "failed"] }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("email_log_event_idx").on(table.eventId),
    index("email_log_contact_idx").on(table.contactId),
  ],
);
