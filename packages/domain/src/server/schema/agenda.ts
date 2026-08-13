import { Schema } from "effect";

import { EntityFields, NullableDate } from "./common";
import { SubmissionStatus } from "./submissions";

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
  aiConfigured: Schema.Boolean,
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

export const AgendaDraftStatus = Schema.Literals(["draft", "generated", "committed", "discarded"]);
export type AgendaDraftStatus = typeof AgendaDraftStatus.Type;

export const AgendaDraftCriteria = Schema.Struct({
  days: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
  roomIds: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
  includeStatuses: Schema.Array(SubmissionStatus).check(Schema.isMinLength(1)),
  // Preferred daily window, minutes since midnight, bounded by the app-wide
  // 8:00–19:00 scheduling canvas. optionalKey: stored criteria predate these
  // keys; absent means the full canvas (solver dayWindow owns the default).
  dayStartMinutes: Schema.optionalKey(Schema.Number),
  dayEndMinutes: Schema.optionalKey(Schema.Number),
  respectExistingPlacements: Schema.Boolean,
  rules: Schema.Array(Schema.String.check(Schema.isMaxLength(200))).check(Schema.isMaxLength(12)),
});
export type AgendaDraftCriteria = typeof AgendaDraftCriteria.Type;

export const AgendaDraftPlacement = Schema.Struct({
  submissionId: Schema.String,
  roomId: Schema.String,
  startsAt: Schema.String,
  endsAt: Schema.String,
  reason: Schema.String,
});
export type AgendaDraftPlacement = typeof AgendaDraftPlacement.Type;

export const AgendaDraftProposal = Schema.Struct({
  placements: Schema.Array(AgendaDraftPlacement),
});
export type AgendaDraftProposal = typeof AgendaDraftProposal.Type;

export const AgendaDraftStored = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  name: Schema.String,
  status: AgendaDraftStatus,
  criteria: AgendaDraftCriteria,
  proposal: AgendaDraftProposal,
  generatedAt: NullableDate,
  committedAt: NullableDate,
});
export type AgendaDraftStored = typeof AgendaDraftStored.Type;

export const AgendaDraft = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  name: Schema.String,
  status: AgendaDraftStatus,
  criteria: AgendaDraftCriteria,
  proposal: AgendaDraftProposal,
  generatedAt: Schema.NullOr(Schema.String),
  committedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type AgendaDraft = typeof AgendaDraft.Type;

export const AgendaDraftsRequest = Schema.Struct({ eventId: Schema.String });

export const GenerateAgendaDraftRequest = Schema.Struct({
  eventId: Schema.String,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  criteria: AgendaDraftCriteria,
});
export type GenerateAgendaDraftRequest = typeof GenerateAgendaDraftRequest.Type;

export const AgendaDraftAction = Schema.Literals(["duplicate", "discard"]);
export const AgendaDraftActionRequest = Schema.Struct({
  eventId: Schema.String,
  draftId: Schema.String,
  action: AgendaDraftAction,
});
export type AgendaDraftActionRequest = typeof AgendaDraftActionRequest.Type;

export const AcceptAgendaDraftRequest = Schema.Struct({
  eventId: Schema.String,
  draftId: Schema.String,
  submissionIds: Schema.Array(Schema.String),
});
export type AcceptAgendaDraftRequest = typeof AcceptAgendaDraftRequest.Type;

export const AcceptAgendaDraftResult = Schema.Struct({
  agenda: AgendaAdminData,
  draft: AgendaDraft,
  changedSubmissionIds: Schema.Array(Schema.String),
});
export type AcceptAgendaDraftResult = typeof AcceptAgendaDraftResult.Type;
