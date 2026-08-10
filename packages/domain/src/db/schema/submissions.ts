import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "../columns";
import { eventMembers, events, formats, levels, rooms, tags, tracks } from "./core";
import { forms } from "./forms";

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    title: text("title"),
    company: text("company"),
    salutation: text("salutation"),
    honorific: text("honorific"),
    pronouns: text("pronouns"),
    gender: text("gender"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    facebookUrl: text("facebook_url"),
    websiteUrl: text("website_url"),
    custom: text("custom", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("contacts_event_email_unique").on(table.eventId, table.email),
    index("contacts_event_idx").on(table.eventId),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    kind: text("kind", { enum: ["abstract", "session"] }).notNull(),
    status: text("status", {
      enum: ["draft", "pending", "maybe", "accepted", "declined", "withdrawn"],
    }).notNull(),
    sourceFormId: text("source_form_id").references(() => forms.id, { onDelete: "set null" }),
    submitterContactId: text("submitter_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    formatId: text("format_id").references(() => formats.id, { onDelete: "set null" }),
    levelId: text("level_id").references(() => levels.id, { onDelete: "set null" }),
    language: text("language").notNull().default("en"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
    capacity: integer("capacity"),
    ceuCredits: integer("ceu_credits"),
    clientSessionId: text("client_session_id"),
    notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    answers: text("answers", { mode: "json" }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("submissions_event_code_unique").on(table.eventId, table.code),
    index("submissions_event_status_idx").on(table.eventId, table.status),
    index("submissions_schedule_idx").on(table.eventId, table.roomId, table.startsAt),
  ],
);

export const submissionTracks = sqliteTable(
  "submission_tracks",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("submission_tracks_submission_track_unique").on(table.submissionId, table.trackId),
    index("submission_tracks_track_idx").on(table.trackId),
  ],
);

export const submissionTags = sqliteTable(
  "submission_tags",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    unique("submission_tags_submission_tag_unique").on(table.submissionId, table.tagId),
    index("submission_tags_tag_idx").on(table.tagId),
  ],
);

export const submissionParticipants = sqliteTable(
  "submission_participants",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("speaker"),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("submission_participants_submission_contact_unique").on(
      table.submissionId,
      table.contactId,
    ),
    index("submission_participants_contact_idx").on(table.contactId),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    decision: text("decision", { enum: ["approve", "maybe", "deny"] }).notNull(),
    score: integer("score"),
    comment: text("comment"),
    ...timestamps,
  },
  (table) => [
    unique("reviews_submission_reviewer_unique").on(table.submissionId, table.reviewerId),
    index("reviews_reviewer_idx").on(table.reviewerId),
  ],
);
