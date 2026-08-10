import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "../columns";
import { events } from "./core";

export const forms = sqliteTable(
  "forms",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    internalName: text("internal_name").notNull(),
    externalTitle: text("external_title").notNull(),
    kind: text("kind", { enum: ["abstract", "session"] }).notNull(),
    collectParticipants: integer("collect_participants", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    welcomeHeading: text("welcome_heading").notNull(),
    welcomeMessage: text("welcome_message").notNull(),
    showWelcome: integer("show_welcome", { mode: "boolean" }).notNull().default(true),
    abstractSection: text("abstract_section", { mode: "json" }).notNull(),
    participantSection: text("participant_section", { mode: "json" }).notNull(),
    participantRoles: text("participant_roles", { mode: "json" }).notNull(),
    closeDate: integer("close_date", { mode: "timestamp_ms" }),
    submissionLimit: integer("submission_limit"),
    allowMultipleDrafts: integer("allow_multiple_drafts", { mode: "boolean" })
      .notNull()
      .default(false),
    successMessage: text("success_message").notNull(),
    autoRedirectPortal: integer("auto_redirect_portal", { mode: "boolean" })
      .notNull()
      .default(true),
    confirmationEmailEnabled: integer("confirmation_email_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    confirmationEmailBody: text("confirmation_email_body").notNull(),
    adminAlertUserIds: text("admin_alert_user_ids", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (table) => [index("forms_event_idx").on(table.eventId)],
);

export const formFields = sqliteTable(
  "form_fields",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    section: text("section", { enum: ["abstract", "participant"] }).notNull(),
    label: text("label").notNull(),
    fieldType: text("field_type", {
      enum: ["text", "richtext", "email", "phone", "dropdown", "checkbox", "file"],
    }).notNull(),
    maxChars: integer("max_chars"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull(),
    options: text("options", { mode: "json" }),
    mapsTo: text("maps_to"),
    condition: text("condition", { mode: "json" }),
    ...timestamps,
  },
  (table) => [index("form_fields_form_position_idx").on(table.formId, table.position)],
);
