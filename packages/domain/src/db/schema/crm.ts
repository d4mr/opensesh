import { index, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { Schema } from "effect";

import { crmSemanticStatus, id, timestamps } from "../columns";
import { events } from "./core";
import { organizations, users } from "./identity";
import { apiKeys } from "./integrations";
import { contacts } from "./submissions";

export const organizationContacts = pgTable(
  "organization_contacts",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    title: text("title"),
    company: text("company"),
    bio: text("bio"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    facebookUrl: text("facebook_url"),
    websiteUrl: text("website_url"),
    headshotUrl: text("headshot_url"),
    custom: jsonb("custom").$type<Readonly<Record<string, Schema.Json>>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    unique("organization_contacts_org_email_unique").on(table.organizationId, table.email),
    index("organization_contacts_org_name_idx").on(
      table.organizationId,
      table.lastName,
      table.firstName,
    ),
  ],
);

export const organizationContactEvents = pgTable(
  "organization_contact_events",
  {
    id: id(),
    organizationContactId: text("organization_contact_id")
      .notNull()
      .references(() => organizationContacts.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("organization_contact_events_org_contact_event_unique").on(
      table.organizationContactId,
      table.eventId,
    ),
    index("organization_contact_events_event_idx").on(table.eventId),
  ],
);

export const organizationContactNotes = pgTable(
  "organization_contact_notes",
  {
    id: id(),
    organizationContactId: text("organization_contact_id")
      .notNull()
      .references(() => organizationContacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "restrict" }),
    authorApiKeyId: text("author_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("organization_contact_notes_contact_idx").on(table.organizationContactId)],
);

export const organizationTags = pgTable(
  "organization_tags",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [unique("organization_tags_org_name_unique").on(table.organizationId, table.name)],
);

export const organizationContactTags = pgTable(
  "organization_contact_tags",
  {
    id: id(),
    organizationContactId: text("organization_contact_id")
      .notNull()
      .references(() => organizationContacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => organizationTags.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("organization_contact_tags_contact_tag_unique").on(
      table.organizationContactId,
      table.tagId,
    ),
    index("organization_contact_tags_tag_idx").on(table.tagId),
  ],
);

export const crmPipelineStages = pgTable(
  "crm_pipeline_stages",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    semanticStatus: crmSemanticStatus("semantic_status").notNull(),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("crm_pipeline_stages_org_name_unique").on(table.organizationId, table.name),
    index("crm_pipeline_stages_org_position_idx").on(table.organizationId, table.position),
  ],
);

export const crmPipelineCards = pgTable(
  "crm_pipeline_cards",
  {
    id: id(),
    organizationContactId: text("organization_contact_id")
      .notNull()
      .references(() => organizationContacts.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => crmPipelineStages.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    unique("crm_pipeline_cards_contact_unique").on(table.organizationContactId),
    index("crm_pipeline_cards_stage_idx").on(table.stageId),
  ],
);

export const crmStageHistory = pgTable(
  "crm_stage_history",
  {
    id: id(),
    cardId: text("card_id")
      .notNull()
      .references(() => crmPipelineCards.id, { onDelete: "cascade" }),
    fromStageId: text("from_stage_id").references(() => crmPipelineStages.id, {
      onDelete: "set null",
    }),
    toStageId: text("to_stage_id")
      .notNull()
      .references(() => crmPipelineStages.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    actorApiKeyId: text("actor_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("crm_stage_history_card_idx").on(table.cardId, table.createdAt)],
);

export const crmSegments = pgTable(
  "crm_segments",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filter: jsonb("filter").$type<Readonly<Record<string, Schema.Json>>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [unique("crm_segments_org_name_unique").on(table.organizationId, table.name)],
);
