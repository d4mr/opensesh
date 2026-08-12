import { Schema } from "effect";

import { NullableDate, NullableNumber, NullableString } from "./common";
import { cancelled, reinstated } from "../mail/templates";
import { ContentApprovalStatus, SessionCancelledBy } from "./submissions";

// The session lens: projections of accepted submissions. Rows carry readiness
// facts (schedule, deliverables, tasks, confirmation, publication) — readiness
// is always derived from these at render time, never stored as a status.

export const SessionSpeaker = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
  position: Schema.Number,
  headshotUrl: NullableString,
  confirmedAt: NullableDate,
});
export type SessionSpeaker = typeof SessionSpeaker.Type;

export const SessionTrack = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
});

export const SessionListItem = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  format: NullableString,
  // CFP-origin sessions link back to their submission; manual sessions have
  // no submission to decline — they can only be cancelled (or deleted when
  // created by mistake).
  source: Schema.Literals(["cfp", "manual"]),
  tracks: Schema.Array(SessionTrack),
  speakers: Schema.Array(SessionSpeaker),
  startsAt: NullableDate,
  endsAt: NullableDate,
  roomId: NullableString,
  roomName: NullableString,
  deliverablesTotal: Schema.Number,
  deliverablesUploaded: Schema.Number,
  tasksTotal: Schema.Number,
  tasksDone: Schema.Number,
  contentReviewStatus: ContentApprovalStatus,
  publicationApproved: Schema.Boolean,
  cancelledAt: NullableDate,
  cancelledBy: Schema.NullOr(SessionCancelledBy),
  capacity: NullableNumber,
  createdAt: Schema.Date,
});
export type SessionListItem = typeof SessionListItem.Type;

export const SessionList = Schema.Struct({
  sessions: Schema.Array(SessionListItem),
  tracks: Schema.Array(SessionTrack),
  formats: Schema.Array(Schema.String),
});
export type SessionList = typeof SessionList.Type;

export const SessionListRequest = Schema.Struct({ eventId: Schema.String });

export const SessionCancelRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  cause: SessionCancelledBy,
  message: Schema.String,
  // Default on; off exists for the fat-fingered accept cancelled seconds
  // later, where a formal cancellation email would be noise.
  notifySpeakers: Schema.Boolean,
});

export const SessionReinstateRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  message: Schema.String,
  notifySpeakers: Schema.Boolean,
});

// Manual sessions only — CFP-origin sessions keep their submission history.
export const SessionDeleteRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
});

export const SessionCancelResult = Schema.Struct({
  id: Schema.String,
  cancelledAt: Schema.Date,
  cancelledBy: SessionCancelledBy,
  createdEmails: Schema.Number,
  waivedTasks: Schema.Number,
});
export type SessionCancelResult = typeof SessionCancelResult.Type;

export const SessionReinstateResult = Schema.Struct({
  id: Schema.String,
  reopenedTasks: Schema.Number,
  createdEmails: Schema.Number,
  // True when the reinstatement email carried a fresh calendar invite —
  // the session was scheduled and invites had gone out before the cancel.
  calendarReinvited: Schema.Boolean,
});
export type SessionReinstateResult = typeof SessionReinstateResult.Type;

// The merged timeline: activity log + row facts + emails + edit history +
// file versions + task completions, one source of truth per event type,
// flattened server-side into presentational entries.
export const TimelineEntryKind = Schema.Literals([
  "created",
  "submitted",
  "status_changed",
  "decided",
  "cancelled",
  "reinstated",
  "scheduled",
  "content_approved",
  "content_edited",
  "email",
  "file",
  "task",
  "speaker_confirmed",
]);
export type TimelineEntryKind = typeof TimelineEntryKind.Type;

export const TimelineEntry = Schema.Struct({
  id: Schema.String,
  at: Schema.Date,
  kind: TimelineEntryKind,
  label: Schema.String,
  detail: NullableString,
  actorName: NullableString,
});
export type TimelineEntry = typeof TimelineEntry.Type;

export const SubmissionTimelineRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
});

export interface CancellationEmailInput {
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly cause: SessionCancelledBy;
  readonly message: string;
}

export const renderCancellationEmail = (input: CancellationEmailInput) =>
  cancelled({ ...input, portalUrl: "https://opensesh.io/portal" });

export interface ReinstatementEmailInput {
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly message: string;
  readonly reinvited: boolean;
}

export const renderReinstatementEmail = (input: ReinstatementEmailInput) =>
  reinstated({ ...input, portalUrl: "https://opensesh.io/portal" });
