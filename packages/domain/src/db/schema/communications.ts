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

import {
  campaignDeliveryStatus,
  emailCampaignStatus,
  id,
  targetType,
  timestamps,
} from "../columns";
import { events } from "./core";
import { users } from "./identity";
import { emailLog } from "./portal";
import { contacts } from "./submissions";

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    mergeFields: jsonb("merge_fields").$type<ReadonlyArray<string>>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    unique("email_templates_event_name_unique").on(table.eventId, table.name),
    index("email_templates_event_idx").on(table.eventId),
  ],
);

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
    subjectSnapshot: text("subject_snapshot").notNull(),
    bodySnapshot: text("body_snapshot").notNull(),
    recipientFilter: jsonb("recipient_filter")
      .$type<Readonly<Record<string, Schema.Json>>>()
      .notNull()
      .default({}),
    status: emailCampaignStatus("status").notNull().default("draft"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("email_campaigns_event_idx").on(table.eventId, table.createdAt)],
);

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    resolvedSubject: text("resolved_subject").notNull(),
    resolvedBody: text("resolved_body").notNull(),
    deliveryStatus: campaignDeliveryStatus("delivery_status").notNull().default("pending"),
    emailLogId: text("email_log_id").references(() => emailLog.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    unique("email_campaign_recipients_campaign_email_unique").on(
      table.campaignId,
      table.recipientEmail,
    ),
    index("email_campaign_recipients_contact_idx").on(table.contactId),
  ],
);

export const reminderRules = pgTable(
  "reminder_rules",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    scope: targetType("scope").notNull(),
    taskType: text("task_type").notNull(),
    daysBeforeDue: integer("days_before_due").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("reminder_rules_event_scope_type_unique").on(table.eventId, table.scope, table.taskType),
    index("reminder_rules_event_idx").on(table.eventId),
  ],
);
