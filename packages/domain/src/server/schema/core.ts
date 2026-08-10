import { Schema, Struct } from "effect";

import { EntityFields, NullableNumber, NullableString, Text1000 } from "./common";

export const EventMemberRole = Schema.Literals(["admin", "reviewer"]);

const eventFields = {
  organizationId: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  type: Schema.String,
  websiteUrl: NullableString,
  location: NullableString,
  timezone: Schema.String,
  startsAt: Schema.Date,
  endsAt: Schema.Date,
  theme: Schema.NullOr(Text1000),
  logoUrl: NullableString,
  backgroundUrl: NullableString,
  defaultSubmissionLimit: Schema.Number,
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

export const Format = Schema.Struct({ ...EntityFields, ...libraryFields });
export type Format = typeof Format.Type;

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
