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
  contentApprovalStatus,
  contactParticipation,
  dietaryRequirement,
  id,
  reviewDecision,
  sessionCancelledBy,
  submissionActivityType,
  submissionStatus,
  timestamps,
  tshirtSize,
} from "../columns";
import { events, formats, levels, rooms, tags, tracks } from "./core";
import { users } from "./identity";
import { apiKeys } from "./integrations";
import { forms } from "./forms";

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    participation: contactParticipation("participation").notNull(),
    title: text("title"),
    company: text("company"),
    salutation: text("salutation"),
    honorific: text("honorific"),
    pronouns: text("pronouns"),
    gender: text("gender"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    headshotKey: text("headshot_key"),
    dietaryRequirements: dietaryRequirement("dietary_requirements").notNull().default("none"),
    tshirtSize: tshirtSize("tshirt_size"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    facebookUrl: text("facebook_url"),
    websiteUrl: text("website_url"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    custom: jsonb("custom").$type<Readonly<Record<string, Schema.Json>>>().notNull(),
    // Last organizer-approved values of public-facing profile fields.
    // Empty object means "no gated edit yet" — public surfaces fall back to
    // the live row. Populated lazily on a confirmed speaker's first edit.
    approvedProfile: jsonb("approved_profile")
      .$type<Readonly<Record<string, Schema.Json>>>()
      .notNull()
      .default({}),
    profileReviewStatus: contentApprovalStatus("profile_review_status")
      .notNull()
      .default("approved"),
    ...timestamps,
  },
  (table) => [
    unique("contacts_event_email_unique").on(table.eventId, table.email),
    index("contacts_event_idx").on(table.eventId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    // The acceptance pipeline. A "session" is not a separate row or a stored
    // kind: it is the projection of an accepted submission (status='accepted'
    // AND cancelled_at IS NULL — see sessionIsActive). Origin is encoded by
    // source_form_id: CFP-origin rows carry the form, manual sessions carry
    // null and never appear on the Submissions desk.
    status: submissionStatus("status").notNull(),
    sourceFormId: text("source_form_id").references(() => forms.id, { onDelete: "set null" }),
    submitterContactId: text("submitter_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    formatId: text("format_id").references(() => formats.id, { onDelete: "set null" }),
    levelId: text("level_id").references(() => levels.id, { onDelete: "set null" }),
    language: text("language").notNull().default("en"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
    icsSequence: integer("ics_sequence").notNull().default(0),
    scheduleDirty: boolean("schedule_dirty").notNull().default(false),
    capacity: integer("capacity"),
    ceuCredits: integer("ceu_credits"),
    clientSessionId: text("client_session_id"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    answers: jsonb("answers").$type<Readonly<Record<string, Schema.Json>>>().notNull(),
    approvedSnapshot: jsonb("approved_snapshot")
      .$type<Readonly<Record<string, Schema.Json>>>()
      .notNull()
      .default({}),
    contentReviewStatus: contentApprovalStatus("content_review_status")
      .notNull()
      .default("approved"),
    // Session cancellation, distinct from the acceptance decision. Schedule
    // fields are deliberately KEPT on cancellation (they are part of the
    // record: "was scheduled Tue 10:00"); the active-session predicate keeps
    // cancelled rows off the agenda, conflicts, and public surfaces, and
    // reinstating restores the slot.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: sessionCancelledBy("cancelled_by"),
    ...timestamps,
  },
  (table) => [
    unique("submissions_event_code_unique").on(table.eventId, table.code),
    index("submissions_event_status_idx").on(table.eventId, table.status),
    index("submissions_schedule_idx").on(table.eventId, table.roomId, table.startsAt),
  ],
);

export const submissionEditHistory = pgTable(
  "submission_edit_history",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    authorContactId: text("author_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorApiKeyId: text("author_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    authorName: text("author_name").notNull(),
    changedFields: jsonb("changed_fields").$type<ReadonlyArray<string>>().notNull(),
    previousValues: jsonb("previous_values")
      .$type<Readonly<Record<string, Schema.Json>>>()
      .notNull(),
    newValues: jsonb("new_values").$type<Readonly<Record<string, Schema.Json>>>().notNull(),
    approvalStatus: contentApprovalStatus("approval_status").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByApiKeyId: text("reviewed_by_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [index("submission_edit_history_submission_idx").on(table.submissionId)],
);

// Append-only. Records only lifecycle transitions whose columns are otherwise
// overwritten in place (status changes, decisions, cancellation/reinstate,
// schedule moves, publication approval). Emails, content edits, file versions,
// and task completions already have durable records of their own and are never
// dual-written here — the timeline read model merges every source at read
// time, one source of truth per event type.
export const submissionActivity = pgTable(
  "submission_activity",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    type: submissionActivityType("type").notNull(),
    actorContactId: text("actor_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorApiKeyId: text("actor_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    actorName: text("actor_name").notNull(),
    payload: jsonb("payload").$type<Readonly<Record<string, Schema.Json>>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [index("submission_activity_submission_idx").on(table.submissionId)],
);

export const contactEditHistory = pgTable(
  "contact_edit_history",
  {
    id: id(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    authorContactId: text("author_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorApiKeyId: text("author_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    authorName: text("author_name").notNull(),
    changedFields: jsonb("changed_fields").$type<ReadonlyArray<string>>().notNull(),
    previousValues: jsonb("previous_values")
      .$type<Readonly<Record<string, Schema.Json>>>()
      .notNull(),
    newValues: jsonb("new_values").$type<Readonly<Record<string, Schema.Json>>>().notNull(),
    approvalStatus: contentApprovalStatus("approval_status").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByApiKeyId: text("reviewed_by_api_key_id").references(() => apiKeys.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [index("contact_edit_history_contact_idx").on(table.contactId)],
);

export const submissionTracks = pgTable(
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

export const submissionTags = pgTable(
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

export const submissionParticipants = pgTable(
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

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    decision: reviewDecision("decision").notNull(),
    score: integer("score"),
    comment: text("comment"),
    ...timestamps,
  },
  (table) => [
    unique("reviews_submission_reviewer_unique").on(table.submissionId, table.reviewerId),
    index("reviews_reviewer_idx").on(table.reviewerId),
  ],
);
