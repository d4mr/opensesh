import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { emailStatus, emailType, id, targetType, taskStatus, timestamps } from "../columns";
import { events } from "./core";
import { contacts, submissions } from "./submissions";

export const portalForms = pgTable(
  "portal_forms",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    targetType: targetType("target_type").notNull(),
    sections: jsonb("sections").notNull(),
    confirmationEmailEnabled: boolean("confirmation_email_enabled").notNull().default(false),
    confirmationEmailBody: text("confirmation_email_body"),
    ...timestamps,
  },
  (table) => [index("portal_forms_event_idx").on(table.eventId)],
);

export const portalFormResponses = pgTable(
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
    answers: jsonb("answers").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("portal_form_responses_form_idx").on(table.formId)],
);

export const fileRequests = pgTable(
  "file_requests",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetType: targetType("target_type").notNull(),
    instructions: text("instructions").notNull(),
    ...timestamps,
  },
  (table) => [index("file_requests_event_idx").on(table.eventId)],
);

export const fileUploads = pgTable(
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
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("file_uploads_request_idx").on(table.fileRequestId)],
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    scope: targetType("scope").notNull(),
    portalFormId: text("portal_form_id").references(() => portalForms.id, {
      onDelete: "set null",
    }),
    fileRequestId: text("file_request_id").references(() => fileRequests.id, {
      onDelete: "set null",
    }),
    autoAssignOnAccept: boolean("auto_assign_on_accept").notNull().default(true),
    dueDate: timestamp("due_date", { withTimezone: true }),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [index("task_templates_event_idx").on(table.eventId)],
);

export const taskAssignments = pgTable(
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
    status: taskStatus("status").notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("task_assignments_contact_idx").on(table.contactId),
    index("task_assignments_submission_idx").on(table.submissionId),
    unique("task_assignments_template_contact_unique").on(table.taskTemplateId, table.contactId),
    unique("task_assignments_template_submission_unique").on(
      table.taskTemplateId,
      table.submissionId,
    ),
  ],
);

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    type: emailType("type").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    icsAttached: boolean("ics_attached").notNull().default(false),
    status: emailStatus("status").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("email_log_event_idx").on(table.eventId),
    index("email_log_contact_idx").on(table.contactId),
    index("email_log_submission_idx").on(table.submissionId),
    unique("email_log_submission_type_contact_unique").on(
      table.submissionId,
      table.type,
      table.contactId,
    ),
  ],
);
