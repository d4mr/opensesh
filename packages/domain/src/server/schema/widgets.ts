import { Schema } from "effect";

import { EntityFields, JsonObject, NullableDate, NullableString } from "./common";
import { EmailStatus, EmailType, FileKind, TaskStatus } from "./portal";

export const WidgetView = Schema.Literals([
  "sessions",
  "speakers",
  "speaker_gallery",
  "agenda",
  "itinerary",
]);
export type WidgetView = typeof WidgetView.Type;

export const WidgetTheme = Schema.Literals(["light", "dark", "auto"]);
export type WidgetTheme = typeof WidgetTheme.Type;
export const WidgetDateFormat = Schema.Literals(["12h", "24h"]);

export const WidgetOptions = Schema.Struct({
  trackIds: Schema.Array(Schema.String),
  formatIds: Schema.Array(Schema.String),
  tagIds: Schema.Array(Schema.String),
  theme: WidgetTheme,
  primaryColor: NullableString,
  dateFormat: WidgetDateFormat,
  showSpeakerCompany: Schema.Boolean,
  showSpeakerTitle: Schema.Boolean,
  showSpeakerBio: Schema.Boolean,
  showSessionDescription: Schema.Boolean,
  showSessionLevel: Schema.Boolean,
  showSessionFormat: Schema.Boolean,
  showAddToCalendar: Schema.Boolean,
});
export type WidgetOptions = typeof WidgetOptions.Type;

export const defaultWidgetOptions: WidgetOptions = {
  trackIds: [],
  formatIds: [],
  tagIds: [],
  theme: "auto",
  primaryColor: null,
  dateFormat: "12h",
  showSpeakerCompany: true,
  showSpeakerTitle: true,
  showSpeakerBio: true,
  showSessionDescription: true,
  showSessionLevel: true,
  showSessionFormat: true,
  showAddToCalendar: true,
};

export const Widget = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  name: Schema.String,
  view: WidgetView,
  enabled: Schema.Boolean,
  options: WidgetOptions,
});
export type Widget = typeof Widget.Type;

export const WidgetRequest = Schema.Struct({ embedId: Schema.String });
export const WidgetListRequest = Schema.Struct({ eventId: Schema.String });
export const WidgetCreateRequest = Schema.Struct({
  eventId: Schema.String,
  name: Schema.String,
  view: WidgetView,
});
export const WidgetUpdateRequest = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  name: Schema.String,
  view: WidgetView,
  enabled: Schema.Boolean,
  options: WidgetOptions,
});

export const PublicProgramRequest = Schema.Struct({ eventSlug: Schema.String });

export const PublicTrack = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
});
export const PublicLibraryItem = Schema.Struct({ id: Schema.String, name: Schema.String });
export const PublicSpeaker = Schema.Struct({
  id: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
  headshotUrl: NullableString,
});
export type PublicSpeaker = typeof PublicSpeaker.Type;
export const PublicSession = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  format: Schema.NullOr(PublicLibraryItem),
  level: Schema.NullOr(PublicLibraryItem),
  tracks: Schema.Array(PublicTrack),
  tags: Schema.Array(PublicLibraryItem),
  speakers: Schema.Array(PublicSpeaker),
  startsAt: Schema.String,
  endsAt: Schema.String,
  roomName: Schema.String,
});
export type PublicSession = typeof PublicSession.Type;
export const PublicProgram = Schema.Struct({
  event: Schema.Struct({
    id: Schema.String,
    slug: Schema.String,
    name: Schema.String,
    tagline: NullableString,
    description: NullableString,
    logoUrl: NullableString,
    location: NullableString,
    timezone: Schema.String,
    startsAt: Schema.String,
    endsAt: Schema.String,
    agendaPublishedAt: NullableString,
  }),
  tracks: Schema.Array(PublicTrack),
  formats: Schema.Array(PublicLibraryItem),
  tags: Schema.Array(PublicLibraryItem),
  sessions: Schema.Array(PublicSession),
});
export type PublicProgram = typeof PublicProgram.Type;

export const PublicWidget = Schema.Struct({
  widget: Widget,
  program: PublicProgram,
});
export type PublicWidget = typeof PublicWidget.Type;

export const SpeakerCsvRow = Schema.Struct({
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
  dietary: Schema.String,
  tshirt: NullableString,
  linkedin: NullableString,
  twitter: NullableString,
  facebook: NullableString,
  website: NullableString,
  phone: NullableString,
});
export type SpeakerCsvRow = typeof SpeakerCsvRow.Type;
export const SpeakerCsvImportRequest = Schema.Struct({
  eventId: Schema.String,
  rows: Schema.Array(SpeakerCsvRow),
});

export const SpeakerDirectoryRow = Schema.Struct({
  contact: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    profileReviewStatus: Schema.Literals(["approved", "pending_review", "rejected"]),
    firstName: Schema.String,
    lastName: Schema.String,
    title: NullableString,
    company: NullableString,
    bio: NullableString,
    headshotUrl: NullableString,
    dietaryRequirements: Schema.String,
    tshirtSize: NullableString,
    phone: NullableString,
    linkedinUrl: NullableString,
    twitterUrl: NullableString,
    facebookUrl: NullableString,
    websiteUrl: NullableString,
  }),
  sessions: Schema.Array(
    Schema.Struct({ id: Schema.String, code: Schema.String, title: Schema.String }),
  ),
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      status: TaskStatus,
      dueDate: NullableDate,
      submissionCode: NullableString,
    }),
  ),
  files: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      versionId: Schema.String,
      filename: Schema.String,
      kind: FileKind,
      label: Schema.String,
      uploadedAt: Schema.Date,
    }),
  ),
  emails: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      subject: Schema.String,
      type: EmailType,
      status: EmailStatus,
      sentAt: NullableDate,
    }),
  ),
  profileChanges: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      changedFields: Schema.Array(Schema.String),
      previousValues: JsonObject,
      newValues: JsonObject,
      authorName: Schema.String,
      approvalStatus: Schema.Literals(["approved", "pending_review", "rejected"]),
      reviewedAt: NullableDate,
      createdAt: Schema.Date,
    }),
  ),
});
export type SpeakerDirectoryRow = typeof SpeakerDirectoryRow.Type;

export const SpeakerDirectory = Schema.Struct({
  rows: Schema.Array(SpeakerDirectoryRow),
  csv: Schema.String,
});
export type SpeakerDirectory = typeof SpeakerDirectory.Type;
