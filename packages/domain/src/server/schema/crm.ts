import { Schema } from "effect";

import { EntityFields, JsonObject, NullableString } from "./common";

export const CrmSemanticStatus = Schema.Literals(["open", "won", "lost"]);
export type CrmSemanticStatus = typeof CrmSemanticStatus.Type;

export const OrganizationContact = Schema.Struct({
  ...EntityFields,
  organizationId: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
  linkedinUrl: NullableString,
  twitterUrl: NullableString,
  facebookUrl: NullableString,
  websiteUrl: NullableString,
  headshotUrl: NullableString,
  custom: JsonObject,
});
export type OrganizationContact = typeof OrganizationContact.Type;

export const OrganizationContactEvent = Schema.Struct({
  ...EntityFields,
  organizationContactId: Schema.String,
  contactId: Schema.String,
  eventId: Schema.String,
  role: Schema.String,
  status: Schema.String,
});
export type OrganizationContactEvent = typeof OrganizationContactEvent.Type;

export const OrganizationContactNote = Schema.Struct({
  id: Schema.String,
  organizationContactId: Schema.String,
  body: Schema.String,
  authorEventMemberId: Schema.String,
  createdAt: Schema.Date,
});
export type OrganizationContactNote = typeof OrganizationContactNote.Type;

export const OrganizationTag = Schema.Struct({
  ...EntityFields,
  organizationId: Schema.String,
  name: Schema.String,
});
export type OrganizationTag = typeof OrganizationTag.Type;

export const CrmPipelineStage = Schema.Struct({
  ...EntityFields,
  organizationId: Schema.String,
  name: Schema.String,
  semanticStatus: CrmSemanticStatus,
  position: Schema.Number,
});
export type CrmPipelineStage = typeof CrmPipelineStage.Type;

export const CrmPipelineCard = Schema.Struct({
  ...EntityFields,
  organizationContactId: Schema.String,
  stageId: Schema.String,
  ownerEventMemberId: NullableString,
  note: NullableString,
});
export type CrmPipelineCard = typeof CrmPipelineCard.Type;

export const CrmStageHistory = Schema.Struct({
  id: Schema.String,
  cardId: Schema.String,
  fromStageId: NullableString,
  toStageId: Schema.String,
  actorEventMemberId: Schema.String,
  createdAt: Schema.Date,
});
export type CrmStageHistory = typeof CrmStageHistory.Type;

export const CrmSegment = Schema.Struct({
  ...EntityFields,
  organizationId: Schema.String,
  name: Schema.String,
  filter: JsonObject,
});
export type CrmSegment = typeof CrmSegment.Type;

export const CrmDirectoryRow = Schema.Struct({
  contact: OrganizationContact,
  tags: Schema.Array(OrganizationTag),
  events: Schema.Array(OrganizationContactEvent),
});
export type CrmDirectoryRow = typeof CrmDirectoryRow.Type;

export const CrmContactDetail = Schema.Struct({
  contact: OrganizationContact,
  tags: Schema.Array(OrganizationTag),
  events: Schema.Array(OrganizationContactEvent),
  notes: Schema.Array(OrganizationContactNote),
  card: Schema.NullOr(CrmPipelineCard),
  stageHistory: Schema.Array(CrmStageHistory),
});
export type CrmContactDetail = typeof CrmContactDetail.Type;

export const CrmPipelineColumn = Schema.Struct({
  stage: CrmPipelineStage,
  cards: Schema.Array(Schema.Struct({ card: CrmPipelineCard, contact: OrganizationContact })),
});
export type CrmPipelineColumn = typeof CrmPipelineColumn.Type;

export const CrmPipelineBoard = Schema.Struct({ columns: Schema.Array(CrmPipelineColumn) });
export type CrmPipelineBoard = typeof CrmPipelineBoard.Type;

export const CrmDirectoryFilters = Schema.Struct({
  search: Schema.String,
  company: Schema.String,
  title: Schema.String,
  tagIds: Schema.Array(Schema.String),
});
export type CrmDirectoryFilters = typeof CrmDirectoryFilters.Type;

export const CrmWorkspaceRequest = Schema.Struct({});
export const CrmContactRequest = Schema.Struct({ id: Schema.String });
export const CrmContactMutationRequest = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
  linkedinUrl: NullableString,
  twitterUrl: NullableString,
  facebookUrl: NullableString,
  websiteUrl: NullableString,
  headshotUrl: NullableString,
  custom: JsonObject,
});
export const CrmNoteRequest = Schema.Struct({
  organizationContactId: Schema.String,
  body: Schema.String,
});
export const CrmTagRequest = Schema.Struct({
  organizationContactId: Schema.String,
  name: Schema.String,
});
export const CrmRemoveTagRequest = Schema.Struct({
  organizationContactId: Schema.String,
  tagId: Schema.String,
});
export const CrmSegmentRequest = Schema.Struct({
  name: Schema.String,
  filter: CrmDirectoryFilters,
});
export const CrmStageMutationRequest = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  semanticStatus: CrmSemanticStatus,
  position: Schema.Number,
});
export const CrmStageDeleteRequest = Schema.Struct({ id: Schema.String });
export const CrmStageReorderRequest = Schema.Struct({ stageIds: Schema.Array(Schema.String) });
export const CrmCardMutationRequest = Schema.Struct({
  organizationContactId: Schema.String,
  stageId: Schema.String,
  note: NullableString,
});
export const CrmCardMoveRequest = Schema.Struct({
  cardId: Schema.String,
  toStageId: Schema.String,
});
export const CrmMergeRequest = Schema.Struct({
  primaryId: Schema.String,
  duplicateId: Schema.String,
});
export const CrmAddToEventRequest = Schema.Struct({
  organizationContactId: Schema.String,
  eventId: Schema.String,
});
export const CrmCsvContact = Schema.Struct({
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
});
export type CrmCsvContact = typeof CrmCsvContact.Type;
export const CrmImportRequest = Schema.Struct({
  behavior: Schema.Literals(["update", "skip"]),
  rows: Schema.Array(CrmCsvContact),
});
export const CrmCampaignRequest = Schema.Struct({
  eventId: Schema.String,
  organizationContactIds: Schema.Array(Schema.String),
  subject: Schema.String,
  body: Schema.String,
});

export const CrmEventSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
});
export type CrmEventSummary = typeof CrmEventSummary.Type;

export const CrmLinkedSession = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  title: Schema.String,
});
export type CrmLinkedSession = typeof CrmLinkedSession.Type;

export const CrmLinkedEvent = Schema.Struct({
  link: OrganizationContactEvent,
  name: Schema.String,
  slug: Schema.String,
  sessions: Schema.Array(CrmLinkedSession),
});
export type CrmLinkedEvent = typeof CrmLinkedEvent.Type;

export const CrmNoteView = Schema.Struct({
  note: OrganizationContactNote,
  authorName: Schema.String,
});
export type CrmNoteView = typeof CrmNoteView.Type;

export const CrmStageHistoryView = Schema.Struct({
  history: CrmStageHistory,
  fromStageName: NullableString,
  toStageName: Schema.String,
  actorName: Schema.String,
});
export type CrmStageHistoryView = typeof CrmStageHistoryView.Type;

export const CrmContactDetailView = Schema.Struct({
  contact: OrganizationContact,
  tags: Schema.Array(OrganizationTag),
  events: Schema.Array(CrmLinkedEvent),
  notes: Schema.Array(CrmNoteView),
  card: Schema.NullOr(CrmPipelineCard),
  stageHistory: Schema.Array(CrmStageHistoryView),
});
export type CrmContactDetailView = typeof CrmContactDetailView.Type;

export const CrmCampaignRecipientView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  resolvedSubject: Schema.String,
  resolvedBody: Schema.String,
  deliveryStatus: Schema.String,
});
export const CrmCampaignView = Schema.Struct({
  id: Schema.String,
  eventId: Schema.String,
  eventName: Schema.String,
  subject: Schema.String,
  status: Schema.String,
  sentAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  recipients: Schema.Array(CrmCampaignRecipientView),
});
export type CrmCampaignView = typeof CrmCampaignView.Type;

export const CrmWorkspace = Schema.Struct({
  organization: Schema.Struct({ id: Schema.String, name: Schema.String }),
  actorEventMemberId: Schema.String,
  events: Schema.Array(CrmEventSummary),
  directory: Schema.Array(CrmDirectoryRow),
  tags: Schema.Array(OrganizationTag),
  segments: Schema.Array(CrmSegment),
  pipeline: CrmPipelineBoard,
  campaigns: Schema.Array(CrmCampaignView),
});
export type CrmWorkspace = typeof CrmWorkspace.Type;

export const CrmImportOutcome = Schema.Struct({
  email: Schema.String,
  action: Schema.Literals(["created", "updated", "skipped"]),
});
export const CrmImportResult = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  skipped: Schema.Number,
  outcomes: Schema.Array(CrmImportOutcome),
});
export type CrmImportResult = typeof CrmImportResult.Type;
