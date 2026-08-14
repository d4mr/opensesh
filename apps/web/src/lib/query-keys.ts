/**
 * The canonical query-key tree. EVERY query key in the app is built from
 * these helpers — never write a key literal anywhere else. Keys mirror the
 * resource paths they cache, so invalidation can scope by prefix:
 *
 *   ["viewer", ...]              — the signed-in user's own context
 *   ["org", ...]                 — organization-wide surfaces (CRM, settings)
 *   ["event", eventId, ...]      — every admin surface of one event
 *   ["public", "event", slug, …] — anonymous program surfaces
 *   ["public", "widget", id]     — anonymous embeds
 *   ["immutable", ...]           — content-addressed blobs; never invalidated
 *
 * `invalidateAfterMutation` (after-mutation.ts) relies on exactly this shape:
 * a write scoped to one event skips the other events' subtrees and the
 * immutable branch, and invalidates everything else.
 */

const event = (eventId: string) => ["event", eventId] as const;

export const qk = {
  event,

  viewer: {
    staff: ["viewer", "staff"] as const,
    portal: ["viewer", "portal"] as const,
    portalEvent: ["viewer", "portal-event"] as const,
    speakerPortal: ["viewer", "speaker-portal"] as const,
    portalResources: ["viewer", "portal-resources"] as const,
    onboarding: ["viewer", "onboarding"] as const,
  },

  org: {
    events: ["org", "events"] as const,
    settings: ["org", "settings"] as const,
    apiKeys: ["org", "api-keys"] as const,
    invitation: (invitationId: string) => ["org", "invitation", invitationId] as const,
    crm: ["org", "crm"] as const,
    crmContact: (contactId: string) => ["org", "crm", "contact", contactId] as const,
  },

  dashboard: (eventId: string) => [...event(eventId), "dashboard"] as const,
  reviewDesk: (eventId: string) => [...event(eventId), "review-desk"] as const,
  reviewDeskDetail: (eventId: string, submissionId: string) =>
    [...event(eventId), "review-desk", "detail", submissionId] as const,
  sessions: (eventId: string) => [...event(eventId), "sessions"] as const,
  submissionTimeline: (eventId: string, submissionId: string) =>
    [...event(eventId), "timeline", submissionId] as const,
  evaluationAdmin: (eventId: string) => [...event(eventId), "evaluation", "admin"] as const,
  reviewerTracks: (eventId: string) => [...event(eventId), "reviewer-tracks"] as const,
  evaluationReviewer: (eventId: string) => [...event(eventId), "evaluation", "reviewer"] as const,
  agenda: (eventId: string) => [...event(eventId), "agenda"] as const,
  agendaDrafts: (eventId: string) => [...event(eventId), "agenda-drafts"] as const,
  calendarInvites: (eventId: string) => [...event(eventId), "calendar-invites"] as const,
  emails: (eventId: string) => [...event(eventId), "emails"] as const,
  communications: (eventId: string) => [...event(eventId), "communications"] as const,
  portalAdmin: (eventId: string) => [...event(eventId), "portal-admin"] as const,
  portalPreviewContacts: (eventId: string) =>
    [...event(eventId), "portal-preview-contacts"] as const,
  resources: (eventId: string) => [...event(eventId), "resources"] as const,
  speakers: (eventId: string) => [...event(eventId), "speakers"] as const,
  contactProfile: (eventId: string, contactId: string) =>
    [...event(eventId), "contact-profile", contactId] as const,
  widgets: (eventId: string) => [...event(eventId), "widgets"] as const,
  forms: (eventId: string) => [...event(eventId), "forms"] as const,
  formEditor: (eventId: string, formId: string) =>
    [...event(eventId), "form-editor", formId] as const,
  library: (eventId: string) => [...event(eventId), "library"] as const,
  access: (eventId: string) => [...event(eventId), "access"] as const,
  integration: (eventId: string) => [...event(eventId), "integration"] as const,

  public: {
    program: (eventSlug: string) => ["public", "event", eventSlug, "program"] as const,
    session: (eventSlug: string, code: string) =>
      ["public", "event", eventSlug, "session", code] as const,
    form: (eventSlug: string, formId: string) =>
      ["public", "event", eventSlug, "form", formId] as const,
    formAccount: (eventSlug: string, formId: string) =>
      ["public", "event", eventSlug, "form-account", formId] as const,
    widget: (embedId: string) => ["public", "widget", embedId] as const,
  },

  immutable: {
    fileVersion: (versionId: string) => ["immutable", "file-version", versionId] as const,
  },
};
