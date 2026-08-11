import { Schema, Struct } from "effect";

import { EntityFields, NullableNumber, NullableString, Text1000 } from "./common";

import { PublishedAgendaSession } from "./agenda";

export const EventMemberRole = Schema.Literals(["admin", "reviewer"]);
export const EventType = Schema.Literals(["conference", "summit", "meetup"]);
export type EventType = typeof EventType.Type;

const eventFields = {
  organizationId: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  tagline: NullableString,
  description: NullableString,
  type: EventType,
  websiteUrl: NullableString,
  location: NullableString,
  timezone: Schema.String,
  startsAt: Schema.Date,
  endsAt: Schema.Date,
  theme: Schema.NullOr(Text1000),
  logoUrl: NullableString,
  logoKey: NullableString,
  backgroundUrl: NullableString,
  defaultSubmissionLimit: Schema.Number,
  agendaPublishedAt: Schema.NullOr(Schema.Date),
  publishedAgenda: Schema.Array(PublishedAgendaSession),
  agendaDirty: Schema.Boolean,
};

export const Event = Schema.Struct({ ...EntityFields, ...eventFields });
export type Event = typeof Event.Type;
export const EventCreate = Schema.Struct(eventFields);
export type EventCreate = typeof EventCreate.Type;
export const EventUpdate = Schema.Struct(Struct.map(eventFields, Schema.optionalKey));
export type EventUpdate = typeof EventUpdate.Type;

export const User = Schema.Struct({
  ...EntityFields,
  email: Schema.String,
  name: Schema.String,
  emailVerified: Schema.Boolean,
  image: NullableString,
});
export type User = typeof User.Type;

export const EventMember = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  userId: Schema.String,
  role: EventMemberRole,
});
export type EventMember = typeof EventMember.Type;

export const OrganizationMember = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.Date,
});
export type OrganizationMember = typeof OrganizationMember.Type;

const libraryFields = {
  eventId: Schema.String,
  name: Schema.String,
  position: Schema.Number,
};

const libraryUpdateFields = Struct.map(Struct.omit(libraryFields, ["eventId"]), Schema.optionalKey);

export const LibraryItemCreate = Schema.Struct(libraryFields);
export type LibraryItemCreate = typeof LibraryItemCreate.Type;
export const LibraryItemUpdate = Schema.Struct(libraryUpdateFields);
export type LibraryItemUpdate = typeof LibraryItemUpdate.Type;

export const Track = Schema.Struct({
  ...EntityFields,
  ...libraryFields,
  color: Schema.String,
});
export type Track = typeof Track.Type;
export const TrackCreate = Schema.Struct({ ...libraryFields, color: Schema.String });
export type TrackCreate = typeof TrackCreate.Type;
export const TrackUpdate = Schema.Struct({
  ...libraryUpdateFields,
  color: Schema.optionalKey(Schema.String),
});
export type TrackUpdate = typeof TrackUpdate.Type;

export const Tag = Schema.Struct({ ...EntityFields, ...libraryFields });
export type Tag = typeof Tag.Type;

export const Format = Schema.Struct({
  ...EntityFields,
  ...libraryFields,
  durationMinutes: Schema.Number,
});
export type Format = typeof Format.Type;
export const FormatCreate = Schema.Struct({
  ...libraryFields,
  durationMinutes: Schema.Number,
});
export type FormatCreate = typeof FormatCreate.Type;
export const FormatUpdate = Schema.Struct({
  ...libraryUpdateFields,
  durationMinutes: Schema.optionalKey(Schema.Number),
});
export type FormatUpdate = typeof FormatUpdate.Type;

export const Level = Schema.Struct({ ...EntityFields, ...libraryFields });
export type Level = typeof Level.Type;

export const Room = Schema.Struct({
  ...EntityFields,
  ...libraryFields,
  capacity: NullableNumber,
});
export type Room = typeof Room.Type;
export const RoomCreate = Schema.Struct({ ...libraryFields, capacity: NullableNumber });
export type RoomCreate = typeof RoomCreate.Type;
export const RoomUpdate = Schema.Struct({
  ...libraryUpdateFields,
  capacity: Schema.optionalKey(NullableNumber),
});
export type RoomUpdate = typeof RoomUpdate.Type;

export const ReviewerTrack = Schema.Struct({
  ...EntityFields,
  eventMemberId: Schema.String,
  trackId: Schema.String,
});
export type ReviewerTrack = typeof ReviewerTrack.Type;

export const EventAdmin = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});
export type EventAdmin = typeof EventAdmin.Type;

// One row per person with access to an event. "organization" entries are
// derived (org owners/admins are admins of every org event) and can only be
// changed in organization settings; "event" entries are the overlay rows.
export const EventAccessEntry = Schema.Struct({
  userId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  source: Schema.Literals(["organization", "event"]),
  role: Schema.Literals(["owner", "admin", "reviewer"]),
});
export type EventAccessEntry = typeof EventAccessEntry.Type;

export const EventAccess = Schema.Struct({
  entries: Schema.Array(EventAccessEntry),
  grantable: Schema.Array(
    Schema.Struct({ userId: Schema.String, name: Schema.String, email: Schema.String }),
  ),
});
export type EventAccess = typeof EventAccess.Type;

export const LibraryKind = Schema.Literals(["track", "format", "room", "tag", "level"]);
export type LibraryKind = typeof LibraryKind.Type;

export const NewEventRequest = Schema.Struct({
  name: Schema.String,
  type: EventType,
  startsAt: Schema.String,
  endsAt: Schema.String,
  timezone: Schema.String,
});

export const EventSettingsRequest = Schema.Struct({
  eventId: Schema.String,
  name: Schema.String,
  tagline: NullableString,
  description: NullableString,
  startsAt: Schema.String,
  endsAt: Schema.String,
  timezone: Schema.String,
  location: NullableString,
  type: EventType,
  websiteUrl: NullableString,
  defaultSubmissionLimit: Schema.Number,
  logoUrl: NullableString,
  logoUpload: Schema.NullOr(
    Schema.Struct({
      filename: Schema.String,
      contentType: Schema.String,
      size: Schema.Number,
      base64: Schema.String,
    }),
  ),
});

export const LibraryMutationRequest = Schema.Struct({
  eventId: Schema.String,
  kind: LibraryKind,
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  color: NullableString,
  durationMinutes: NullableNumber,
});

export const LibraryDeleteRequest = Schema.Struct({
  eventId: Schema.String,
  kind: LibraryKind,
  id: Schema.String,
});
