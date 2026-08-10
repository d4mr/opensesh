import { Schema } from "effect";

export const AgendaView = Schema.Literals(["rooms", "list", "conflicts"]);
export type AgendaView = typeof AgendaView.Type;

export const AgendaTrack = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
});
export type AgendaTrack = typeof AgendaTrack.Type;

export const AgendaRoom = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  position: Schema.Number,
});
export type AgendaRoom = typeof AgendaRoom.Type;

export const AgendaSpeaker = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export type AgendaSpeaker = typeof AgendaSpeaker.Type;

export const AgendaSession = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  startsAt: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.String),
  roomId: Schema.NullOr(Schema.String),
  scheduleDirty: Schema.Boolean,
  durationMinutes: Schema.Number,
  formatName: Schema.NullOr(Schema.String),
  tracks: Schema.Array(AgendaTrack),
  speakers: Schema.Array(AgendaSpeaker),
});
export type AgendaSession = typeof AgendaSession.Type;

export const AgendaAdminData = Schema.Struct({
  event: Schema.Struct({
    id: Schema.String,
    slug: Schema.String,
    name: Schema.String,
    timezone: Schema.String,
    startsAt: Schema.String,
    endsAt: Schema.String,
    agendaPublishedAt: Schema.NullOr(Schema.String),
    agendaDirty: Schema.Boolean,
  }),
  rooms: Schema.Array(AgendaRoom),
  tracks: Schema.Array(AgendaTrack),
  sessions: Schema.Array(AgendaSession),
});
export type AgendaAdminData = typeof AgendaAdminData.Type;

export const AgendaConflictKind = Schema.Literals(["room", "speaker"]);
export type AgendaConflictKind = typeof AgendaConflictKind.Type;

export const AgendaConflict = Schema.Struct({
  id: Schema.String,
  kind: AgendaConflictKind,
  sessionIds: Schema.Tuple([Schema.String, Schema.String]),
  roomId: Schema.NullOr(Schema.String),
  speaker: Schema.NullOr(AgendaSpeaker),
  startsAt: Schema.String,
  endsAt: Schema.String,
});
export type AgendaConflict = typeof AgendaConflict.Type;

export const AgendaRequest = Schema.Struct({ eventId: Schema.String });

export const ScheduleChange = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  roomId: Schema.NullOr(Schema.String),
  startsAt: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.String),
});
export type ScheduleChange = typeof ScheduleChange.Type;

export const AgendaPublicationAction = Schema.Literals(["publish", "unpublish"]);
export const AgendaPublicationRequest = Schema.Struct({
  eventId: Schema.String,
  action: AgendaPublicationAction,
});

export const PublishedAgendaSession = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  startsAt: Schema.String,
  endsAt: Schema.String,
  roomName: Schema.String,
  tracks: Schema.Array(AgendaTrack),
  speakers: Schema.Array(AgendaSpeaker),
});
export type PublishedAgendaSession = typeof PublishedAgendaSession.Type;

export const PublicAgenda = Schema.Struct({
  event: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
    timezone: Schema.String,
    publishedAt: Schema.String,
  }),
  sessions: Schema.Array(PublishedAgendaSession),
});
export type PublicAgenda = typeof PublicAgenda.Type;

export const PublicAgendaRequest = Schema.Struct({ eventSlug: Schema.String });
