import { Schema } from "effect";

import { EntityFields, JsonObject, NullableDate, NullableString } from "./common";

export const EmailCampaignStatus = Schema.Literals(["draft", "sending", "sent"]);
export const CampaignDeliveryStatus = Schema.Literals(["pending", "sent", "failed"]);

export const EmailTemplate = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  name: Schema.String,
  subjectTemplate: Schema.String,
  bodyTemplate: Schema.String,
  mergeFields: Schema.Array(Schema.String),
});
export type EmailTemplate = typeof EmailTemplate.Type;

export const EmailCampaign = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  templateId: NullableString,
  subjectSnapshot: Schema.String,
  bodySnapshot: Schema.String,
  recipientFilter: JsonObject,
  status: EmailCampaignStatus,
  createdByEventMemberId: Schema.String,
  sentAt: NullableDate,
});
export type EmailCampaign = typeof EmailCampaign.Type;

export const EmailCampaignRecipient = Schema.Struct({
  ...EntityFields,
  campaignId: Schema.String,
  contactId: Schema.String,
  resolvedSubject: Schema.String,
  resolvedBody: Schema.String,
  deliveryStatus: CampaignDeliveryStatus,
  emailLogId: NullableString,
});
export type EmailCampaignRecipient = typeof EmailCampaignRecipient.Type;

export const ReminderRule = Schema.Struct({
  ...EntityFields,
  eventId: Schema.String,
  scope: Schema.Literals(["contact", "submission"]),
  taskType: Schema.String,
  daysBeforeDue: Schema.Number,
  enabled: Schema.Boolean,
  lastRunAt: NullableDate,
});
export type ReminderRule = typeof ReminderRule.Type;

export const resolveMergeFields = (template: string, fields: Readonly<Record<string, string>>) =>
  Object.entries(fields).reduce(
    (resolved, [name, value]) => resolved.replaceAll(`{${name}}`, value),
    template,
  );
