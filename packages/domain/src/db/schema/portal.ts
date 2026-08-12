import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Schema } from "effect";

import type { PortalFormSection } from "../../server/schema/portal";
import {
  emailStatus,
  emailType,
  deliverableStatus,
  fileKind,
  id,
  resourceAttachmentKind,
  resourceAudienceMode,
  targetType,
  taskStatus,
  timestamps,
} from "../columns";
import { events, tracks } from "./core";
import { users } from "./identity";
import { contacts, submissions } from "./submissions";

export const resources = pgTable(
  "resources",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    body: text("body").notNull(),
    position: integer("position").notNull(),
    published: boolean("published").notNull().default(false),
    audienceMode: resourceAudienceMode("audience_mode").notNull().default("all"),
    attachmentKind: resourceAttachmentKind("attachment_kind"),
    linkUrl: text("link_url"),
    embedUrl: text("embed_url"),
    fileStorageKey: text("file_storage_key"),
    fileName: text("file_name"),
    fileContentType: text("file_content_type"),
    fileSize: integer("file_size"),
    ...timestamps,
  },
  (table) => [
    index("resources_event_position_idx").on(table.eventId, table.position),
    unique("resources_file_storage_key_unique").on(table.fileStorageKey),
    check(
      "resources_attachment_shape_check",
      sql`(
        (${table.attachmentKind} is null and ${table.linkUrl} is null and ${table.embedUrl} is null and ${table.fileStorageKey} is null and ${table.fileName} is null and ${table.fileContentType} is null and ${table.fileSize} is null)
        or (${table.attachmentKind} = 'link' and ${table.linkUrl} is not null and ${table.embedUrl} is null and ${table.fileStorageKey} is null and ${table.fileName} is null and ${table.fileContentType} is null and ${table.fileSize} is null)
        or (${table.attachmentKind} = 'embed' and ${table.linkUrl} is null and ${table.embedUrl} is not null and ${table.fileStorageKey} is null and ${table.fileName} is null and ${table.fileContentType} is null and ${table.fileSize} is null)
        or (${table.attachmentKind} = 'file' and ${table.linkUrl} is null and ${table.embedUrl} is null and ${table.fileStorageKey} is not null and ${table.fileName} is not null and ${table.fileContentType} is not null and ${table.fileSize} is not null)
      )`,
    ),
  ],
);

export const resourceTracks = pgTable(
  "resource_tracks",
  {
    id: id(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("resource_tracks_resource_track_unique").on(table.resourceId, table.trackId),
    index("resource_tracks_resource_idx").on(table.resourceId),
    index("resource_tracks_track_idx").on(table.trackId),
  ],
);

export const resourceContacts = pgTable(
  "resource_contacts",
  {
    id: id(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("resource_contacts_resource_contact_unique").on(table.resourceId, table.contactId),
    index("resource_contacts_resource_idx").on(table.resourceId),
    index("resource_contacts_contact_idx").on(table.contactId),
  ],
);

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
    dueAt: timestamp("due_at", { withTimezone: true }),
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
    scope: targetType("scope").notNull().default("contact"),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [index("session_file_requirements_event_idx").on(table.eventId, table.position)],
);

export const sessionFileRequirementAssignments = pgTable(
  "session_file_requirement_assignments",
  {
    id: id(),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => sessionFileRequirements.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    status: deliverableStatus("status").notNull().default("outstanding"),
    ...timestamps,
  },
  (table) => [
    index("session_file_requirement_assignments_requirement_idx").on(table.requirementId),
    index("session_file_requirement_assignments_submission_idx").on(table.submissionId),
    index("session_file_requirement_assignments_contact_idx").on(table.contactId),
    unique("session_file_requirement_assignments_target_unique")
      .on(table.requirementId, table.submissionId, table.contactId)
      .nullsNotDistinct(),
  ],
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
    assignmentId: text("assignment_id").references(() => sessionFileRequirementAssignments.id, {
      onDelete: "cascade",
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
    index("file_uploads_assignment_idx").on(table.assignmentId),
    index("file_uploads_contact_idx").on(table.contactId),
    unique("file_uploads_assignment_unique").on(table.assignmentId),
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
    uploaderUserId: text("uploader_user_id").references(() => users.id, {
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
    authorUserId: text("author_user_id").references(() => users.id, {
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
