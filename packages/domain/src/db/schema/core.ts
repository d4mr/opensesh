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

import { eventMemberRole, id, timestamps } from "../columns";
import { organizations, users } from "./identity";

interface PublishedAgendaRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly roomName: string;
  readonly tracks: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }>;
  readonly speakers: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

export const events = pgTable("events", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline"),
  description: text("description"),
  type: text("type").notNull().default("conference"),
  websiteUrl: text("website_url"),
  location: text("location"),
  timezone: text("timezone").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  theme: text("theme"),
  logoUrl: text("logo_url"),
  backgroundUrl: text("background_url"),
  defaultSubmissionLimit: integer("default_submission_limit").notNull().default(3),
  agendaPublishedAt: timestamp("agenda_published_at", { withTimezone: true }),
  publishedAgenda: jsonb("published_agenda")
    .$type<ReadonlyArray<PublishedAgendaRecord>>()
    .notNull()
    .default([]),
  agendaDirty: boolean("agenda_dirty").notNull().default(false),
  ...timestamps,
});

export const eventMembers = pgTable(
  "event_members",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: eventMemberRole("role").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("event_members_event_user_unique").on(table.eventId, table.userId),
    index("event_members_event_idx").on(table.eventId),
  ],
);

const libraryColumns = {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  ...timestamps,
};

export const tracks = pgTable(
  "tracks",
  {
    ...libraryColumns,
    color: text("color").notNull(),
  },
  (table) => [
    unique("tracks_event_name_unique").on(table.eventId, table.name),
    index("tracks_event_idx").on(table.eventId),
  ],
);

export const tags = pgTable("tags", libraryColumns, (table) => [
  unique("tags_event_name_unique").on(table.eventId, table.name),
  index("tags_event_idx").on(table.eventId),
]);

export const formats = pgTable(
  "formats",
  { ...libraryColumns, durationMinutes: integer("duration_minutes").notNull().default(30) },
  (table) => [
    unique("formats_event_name_unique").on(table.eventId, table.name),
    index("formats_event_idx").on(table.eventId),
  ],
);

export const levels = pgTable("levels", libraryColumns, (table) => [
  unique("levels_event_name_unique").on(table.eventId, table.name),
  index("levels_event_idx").on(table.eventId),
]);

export const rooms = pgTable(
  "rooms",
  {
    ...libraryColumns,
    capacity: integer("capacity"),
  },
  (table) => [
    unique("rooms_event_name_unique").on(table.eventId, table.name),
    index("rooms_event_idx").on(table.eventId),
  ],
);

export const reviewerTracks = pgTable(
  "reviewer_tracks",
  {
    id: id(),
    eventMemberId: text("event_member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("reviewer_tracks_member_track_unique").on(table.eventMemberId, table.trackId),
    index("reviewer_tracks_member_idx").on(table.eventMemberId),
  ],
);
