import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { formFieldType, formSection, formStatus, id, submissionKind, timestamps } from "../columns";
import { events } from "./core";

export const forms = pgTable(
  "forms",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    internalName: text("internal_name").notNull(),
    externalTitle: text("external_title").notNull(),
    kind: submissionKind("kind").notNull(),
    collectParticipants: boolean("collect_participants").notNull().default(true),
    status: formStatus("status").notNull().default("open"),
    welcomeHeading: text("welcome_heading").notNull(),
    welcomeMessage: text("welcome_message").notNull(),
    showWelcome: boolean("show_welcome").notNull().default(true),
    abstractSection: jsonb("abstract_section").notNull(),
    participantSection: jsonb("participant_section").notNull(),
    participantRoles: jsonb("participant_roles").notNull(),
    closeDate: timestamp("close_date", { withTimezone: true }),
    submissionLimit: integer("submission_limit"),
    allowMultipleDrafts: boolean("allow_multiple_drafts").notNull().default(false),
    successMessage: text("success_message").notNull(),
    autoRedirectPortal: boolean("auto_redirect_portal").notNull().default(true),
    confirmationEmailEnabled: boolean("confirmation_email_enabled").notNull().default(true),
    confirmationEmailBody: text("confirmation_email_body").notNull(),
    adminAlertUserIds: jsonb("admin_alert_user_ids").notNull(),
    ...timestamps,
  },
  (table) => [index("forms_event_idx").on(table.eventId)],
);

export const formFields = pgTable(
  "form_fields",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    section: formSection("section").notNull(),
    label: text("label").notNull(),
    fieldType: formFieldType("field_type").notNull(),
    maxChars: integer("max_chars"),
    required: boolean("required").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    position: integer("position").notNull(),
    options: jsonb("options"),
    mapsTo: text("maps_to"),
    condition: jsonb("condition"),
    ...timestamps,
  },
  (table) => [index("form_fields_form_position_idx").on(table.formId, table.position)],
);
