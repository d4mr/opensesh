import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { AgendaDraftCriteria, AgendaDraftProposal } from "../../server/schema/agenda";
import { agendaDraftStatus, id, timestamps } from "../columns";
import { events } from "./core";

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
