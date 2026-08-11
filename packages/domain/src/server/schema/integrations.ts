import { Schema } from "effect";

// Accelevents is the only provider today, but rows are keyed (event, provider)
// so a second registration platform is additive.
export const IntegrationProvider = Schema.Literals(["accelevents"]);
export type IntegrationProvider = typeof IntegrationProvider.Type;

export const AcceleventsOutcome = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  skipped: Schema.Number,
});
export type AcceleventsOutcome = typeof AcceleventsOutcome.Type;

export const AcceleventsSyncReport = Schema.Struct({
  speakers: AcceleventsOutcome,
  attendees: Schema.NullOr(AcceleventsOutcome),
  linkedToEvent: Schema.Number,
  syncedAt: Schema.String,
});
export type AcceleventsSyncReport = typeof AcceleventsSyncReport.Type;

// What admin surfaces see: the API key never leaves the server — only its
// presence and a display prefix.
export const EventIntegrationView = Schema.Struct({
  provider: IntegrationProvider,
  eventUrl: Schema.String,
  hasApiKey: Schema.Boolean,
  apiKeyPreview: Schema.NullOr(Schema.String),
  importAttendees: Schema.Boolean,
  lastSyncedAt: Schema.NullOr(Schema.String),
  lastResult: Schema.NullOr(AcceleventsSyncReport),
});
export type EventIntegrationView = typeof EventIntegrationView.Type;

export const IntegrationSettingsRequest = Schema.Struct({
  eventId: Schema.String,
});
export const SaveIntegrationRequest = Schema.Struct({
  eventId: Schema.String,
  eventUrl: Schema.String,
  // null = keep the previously stored key (the client never sees it back).
  apiKey: Schema.NullOr(Schema.String),
  importAttendees: Schema.Boolean,
});
export type SaveIntegrationRequest = typeof SaveIntegrationRequest.Type;

export const RunIntegrationSyncRequest = Schema.Struct({
  eventId: Schema.String,
});
