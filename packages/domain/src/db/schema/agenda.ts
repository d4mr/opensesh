import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { AgendaDraftCriteria, AgendaDraftProposal } from "../../server/schema/agenda";
import { agendaBlockKind, agendaDraftStatus, id, timestamps } from "../columns";
import { events, rooms } from "./core";

export const agendaDrafts = pgTable(
  "agenda_drafts",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: agendaDraftStatus("status").notNull().default("draft"),
    criteria: jsonb("criteria").$type<AgendaDraftCriteria>().notNull(),
    proposal: jsonb("proposal").$type<AgendaDraftProposal>().notNull().default({ placements: [] }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("agenda_drafts_event_created_idx").on(table.eventId, table.createdAt)],
);

// Non-session agenda structure: registration, breaks, lunch, socials. They
// sit on the same time grid as sessions but never come from submissions.
export const agendaBlocks = pgTable(
  "agenda_blocks",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: agendaBlockKind("kind").notNull().default("break"),
    // null spans every room (plenary breaks, lunch, registration).
    roomId: text("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("agenda_blocks_event_starts_idx").on(table.eventId, table.startsAt)],
);
