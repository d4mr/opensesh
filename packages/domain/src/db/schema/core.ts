import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "../columns";

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const events = sqliteTable("events", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("conference"),
  websiteUrl: text("website_url"),
  location: text("location"),
  timezone: text("timezone").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  theme: text("theme"),
  logoUrl: text("logo_url"),
  backgroundUrl: text("background_url"),
  defaultSubmissionLimit: integer("default_submission_limit").notNull().default(3),
  ...timestamps,
});

export const eventMembers = sqliteTable(
  "event_members",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "reviewer"] }).notNull(),
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

export const tracks = sqliteTable(
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

export const tags = sqliteTable("tags", libraryColumns, (table) => [
  unique("tags_event_name_unique").on(table.eventId, table.name),
  index("tags_event_idx").on(table.eventId),
]);

export const formats = sqliteTable("formats", libraryColumns, (table) => [
  unique("formats_event_name_unique").on(table.eventId, table.name),
  index("formats_event_idx").on(table.eventId),
]);

export const levels = sqliteTable("levels", libraryColumns, (table) => [
  unique("levels_event_name_unique").on(table.eventId, table.name),
  index("levels_event_idx").on(table.eventId),
]);

export const rooms = sqliteTable(
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

export const reviewerTracks = sqliteTable(
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
