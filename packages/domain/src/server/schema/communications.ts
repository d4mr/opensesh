import { Schema } from "effect";

import { EntityFields, JsonObject, NullableDate, NullableString } from "./common";

import { DietaryRequirement, SpeakerWorkflowStatus, TshirtSize } from "./submissions";

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
  createdByUserId: Schema.String,
  sentAt: NullableDate,
});
export type EmailCampaign = typeof EmailCampaign.Type;

export const EmailCampaignRecipient = Schema.Struct({
  ...EntityFields,
  campaignId: Schema.String,
  contactId: NullableString,
  recipientName: Schema.String,
  recipientEmail: Schema.String,
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

export const CommunicationContact = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  headshotUrl: NullableString,
  title: NullableString,
  company: NullableString,
  workflowStatus: SpeakerWorkflowStatus,
  taskTotal: Schema.Number,
  taskDone: Schema.Number,
  taskIncomplete: Schema.Number,
  talkTitle: Schema.String,
});
export type CommunicationContact = typeof CommunicationContact.Type;

export const CampaignRecipientHistory = Schema.Struct({
  id: Schema.String,
  contactId: Schema.String,
  contactName: Schema.String,
  email: Schema.String,
  resolvedSubject: Schema.String,
  resolvedBody: Schema.String,
  deliveryStatus: CampaignDeliveryStatus,
  emailLogId: NullableString,
  emailStatus: Schema.NullOr(Schema.Literals(["queued", "demo", "sent", "failed"])),
});
export type CampaignRecipientHistory = typeof CampaignRecipientHistory.Type;

export const CampaignHistory = Schema.Struct({
  campaign: EmailCampaign,
  templateName: NullableString,
  recipients: Schema.Array(CampaignRecipientHistory),
});
export type CampaignHistory = typeof CampaignHistory.Type;

export const CommunicationCenter = Schema.Struct({
  eventName: Schema.String,
  eventSlug: Schema.String,
  contacts: Schema.Array(CommunicationContact),
  templates: Schema.Array(EmailTemplate),
  campaigns: Schema.Array(CampaignHistory),
  reminderRules: Schema.Array(ReminderRule),
});
export type CommunicationCenter = typeof CommunicationCenter.Type;

export const PortalInvitationResult = Schema.Struct({
  contactId: Schema.String,
  contactName: Schema.String,
  portalPath: Schema.String,
  alreadyInvited: Schema.Boolean,
  logId: NullableString,
});
export type PortalInvitationResult = typeof PortalInvitationResult.Type;

export const resolveMergeFields = (template: string, fields: Readonly<Record<string, string>>) =>
  Object.entries(fields).reduce(
    (resolved, [name, value]) => resolved.replaceAll(`{${name}}`, value),
    template,
  );

export const campaignMergeTokens = [
  "speaker_name",
  "talk_title",
  "event_name",
  "portal_url",
] as const;

export interface CampaignRecipientSource {
  readonly contactId: string;
  readonly speakerName: string;
  readonly talkTitle: string;
  readonly email: string;
}

export const buildCampaignRecipientRows = (input: {
  readonly campaignId: string;
  readonly subject: string;
  readonly body: string;
  readonly eventName: string;
  readonly portalUrl: string;
  readonly recipients: ReadonlyArray<CampaignRecipientSource>;
}) =>
  input.recipients.map((recipient) => {
    const fields = {
      speaker_name: recipient.speakerName,
      talk_title: recipient.talkTitle,
      event_name: input.eventName,
      portal_url: input.portalUrl,
    };
    return {
      campaignId: input.campaignId,
      contactId: recipient.contactId,
      recipientName: recipient.speakerName,
      recipientEmail: recipient.email,
      resolvedSubject: resolveMergeFields(input.subject, fields),
      resolvedBody: resolveMergeFields(input.body, fields),
    };
  });

export const SpeakerProfileMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: NullableString,
  company: NullableString,
  bio: NullableString,
  linkedinUrl: NullableString,
  twitterUrl: NullableString,
  websiteUrl: NullableString,
  dietaryRequirements: DietaryRequirement,
  tshirtSize: Schema.NullOr(TshirtSize),
  travelLogistics: NullableString,
  workflowStatus: SpeakerWorkflowStatus,
});

export const SpeakerWorkflowMutationRequest = Schema.Struct({
  eventId: Schema.String,
  contactId: Schema.String,
  workflowStatus: SpeakerWorkflowStatus,
});

export const SpeakerHeadshotUploadRequest = Schema.Struct({
  eventId: Schema.String,
  contactId: Schema.String,
  filename: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  base64: Schema.String,
});

export const PortalInvitationRequest = Schema.Struct({
  eventId: Schema.String,
  contactIds: Schema.Array(Schema.String),
});

export const CommunicationCenterRequest = Schema.Struct({ eventId: Schema.String });

export const EmailTemplateMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  subjectTemplate: Schema.String,
  bodyTemplate: Schema.String,
});

export const EmailTemplateDeleteRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.String,
});

export const CampaignSendRequest = Schema.Struct({
  eventId: Schema.String,
  templateId: NullableString,
  subject: Schema.String,
  body: Schema.String,
  recipientFilter: JsonObject,
  contactIds: Schema.Array(Schema.String),
});

export const ReminderRuleMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.String,
  daysBeforeDue: Schema.Number,
  enabled: Schema.Boolean,
});

export const ReminderRuleRunRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.String,
});

export interface ReminderAssignmentSource {
  readonly assignmentId: string;
  readonly contactId: string;
  readonly status: "todo" | "done" | "waived";
  readonly dueDate: Date | null;
  readonly taskTitle: string;
}

export const reminderAssignmentsWithinWindow = (
  assignments: ReadonlyArray<ReminderAssignmentSource>,
  now: Date,
  daysBeforeDue: number,
) => {
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + Math.max(0, daysBeforeDue));
  windowEnd.setUTCHours(23, 59, 59, 999);
  return assignments.filter(
    (assignment) =>
      assignment.status === "todo" &&
      assignment.dueDate !== null &&
      assignment.dueDate >= windowStart &&
      assignment.dueDate <= windowEnd,
  );
};

export const reminderAlreadyRanInWindow = (lastRunAt: Date | null, now: Date) => {
  if (lastRunAt === null) return false;
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);
  return lastRunAt >= windowStart && lastRunAt <= now;
};
