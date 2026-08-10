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
