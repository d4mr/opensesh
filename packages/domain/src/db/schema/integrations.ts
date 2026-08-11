import { index, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { Schema } from "effect";

import { id, timestamps } from "../columns";
import { events } from "./core";
import { organizations, users } from "./identity";

// One row per (event, provider) connection. Provider-specific settings live in
// the config jsonb (for Accelevents: eventUrl, apiKey, importAttendees); the
// latest sync outcome is denormalized here so the settings UI can show it
// without a second table.
export const eventIntegrations = pgTable(
  "event_integrations",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    config: jsonb("config").$type<Readonly<Record<string, Schema.Json>>>().notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastResult: jsonb("last_result").$type<Readonly<Record<string, Schema.Json>>>(),
    ...timestamps,
  },
  (table) => [unique("event_integrations_event_provider_unique").on(table.eventId, table.provider)],
);

// Organization-scoped machine credentials for the REST API. Only a SHA-256
// hash of the token is stored; the prefix (e.g. "osk_3f9a") is kept so the
// settings UI can identify keys without revealing them.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("api_keys_org_idx").on(table.organizationId)],
);
