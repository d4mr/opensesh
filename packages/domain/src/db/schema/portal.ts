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
import type { Schema } from "effect";

import type { PortalFormSection } from "../../server/schema/portal";
import {
  emailStatus,
  emailType,
  fileKind,
  id,
  targetType,
  taskStatus,
  timestamps,
} from "../columns";
import { eventMembers, events } from "./core";
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
    sections: jsonb("sections").$type<ReadonlyArray<PortalFormSection>>().notNull(),
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
    answers: jsonb("answers").$type<Readonly<Record<string, Schema.Json>>>().notNull(),
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

export const sessionFileRequirements = pgTable(
  "session_file_requirements",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    acceptTypes: text("accept_types"),
    maxSizeMb: integer("max_size_mb"),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [index("session_file_requirements_event_idx").on(table.eventId, table.position)],
);

export const fileUploads = pgTable(
  "file_uploads",
  {
    id: id(),
    fileRequestId: text("file_request_id").references(() => fileRequests.id, {
      onDelete: "cascade",
    }),
    requirementId: text("requirement_id").references(() => sessionFileRequirements.id, {
      onDelete: "set null",
    }),
    kind: fileKind("kind").notNull(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    speakerLastReadAt: timestamp("speaker_last_read_at", { withTimezone: true }),
    adminLastReadAt: timestamp("admin_last_read_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("file_uploads_request_idx").on(table.fileRequestId),
    index("file_uploads_requirement_idx").on(table.requirementId),
    index("file_uploads_contact_idx").on(table.contactId),
    unique("file_uploads_submission_requirement_unique").on(
      table.submissionId,
      table.requirementId,
    ),
  ],
);

export const fileVersions = pgTable(
  "file_versions",
  {
    id: id(),
    fileUploadId: text("file_upload_id")
      .notNull()
      .references(() => fileUploads.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploaderContactId: text("uploader_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    uploaderEventMemberId: text("uploader_event_member_id").references(() => eventMembers.id, {
      onDelete: "set null",
    }),
    uploaderName: text("uploader_name").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("file_versions_storage_key_unique").on(table.storageKey),
    index("file_versions_upload_idx").on(table.fileUploadId, table.uploadedAt),
  ],
);

export const fileComments = pgTable(
  "file_comments",
  {
    id: id(),
    fileUploadId: text("file_upload_id")
      .notNull()
      .references(() => fileUploads.id, { onDelete: "cascade" }),
    authorContactId: text("author_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    authorEventMemberId: text("author_event_member_id").references(() => eventMembers.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [index("file_comments_upload_idx").on(table.fileUploadId, table.createdAt)],
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
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    htmlBody: text("html_body").notNull(),
    icsAttached: boolean("ics_attached").notNull().default(false),
    icsContent: text("ics_content"),
    icsSequence: integer("ics_sequence"),
    status: emailStatus("status").notNull(),
    provider: text("provider"),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("email_log_event_idx").on(table.eventId),
    index("email_log_contact_idx").on(table.contactId),
    index("email_log_submission_idx").on(table.submissionId),
  ],
);
