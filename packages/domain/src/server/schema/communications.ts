import { outreach } from "@opensesh/email";
import { Schema } from "effect";

import { freeformToHtml } from "../../rich-text";
import { EntityFields, JsonObject, NullableDate, NullableString } from "./common";

import { DietaryRequirement, SpeakerPipeline, SubmissionStatus, TshirtSize } from "./submissions";

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
  replyTo: NullableString,
  status: EmailCampaignStatus,
  createdByUserId: NullableString,
  createdByApiKeyId: NullableString,
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

export const CommunicationSpeaker = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  headshotUrl: NullableString,
  title: NullableString,
  company: NullableString,
  pipeline: SpeakerPipeline,
  confirmedAt: NullableDate,
  decisionInformed: Schema.Boolean,
  taskTotal: Schema.Number,
  taskDone: Schema.Number,
  taskIncomplete: Schema.Number,
  talkTitle: Schema.String,
});
export type CommunicationSpeaker = typeof CommunicationSpeaker.Type;

export const CommunicationSubmitter = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  firstName: Schema.String,
  lastName: Schema.String,
  headshotUrl: NullableString,
  submissions: Schema.Array(Schema.Struct({ status: SubmissionStatus, notifiedAt: NullableDate })),
});
export type CommunicationSubmitter = typeof CommunicationSubmitter.Type;

export const CampaignRecipientHistory = Schema.Struct({
  id: Schema.String,
  contactId: Schema.String,
  contactName: Schema.String,
  email: Schema.String,
  resolvedSubject: Schema.String,
  resolvedBody: Schema.String,
  deliveryStatus: CampaignDeliveryStatus,
  emailLogId: NullableString,
  emailStatus: Schema.NullOr(Schema.Literals(["queued", "sending", "demo", "sent", "failed"])),
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
  speakers: Schema.Array(CommunicationSpeaker),
  submitters: Schema.Array(CommunicationSubmitter),
  pending: Schema.Struct({
    acceptedNotInformed: Schema.Number,
    declinedNotInformed: Schema.Number,
    awaitingConfirmation: Schema.Number,
    queued: Schema.Number,
    sending: Schema.Number,
    failed: Schema.Number,
    sentTotal: Schema.Number,
    dueSoonTasks: Schema.Number,
  }),
  templates: Schema.Array(EmailTemplate),
  campaigns: Schema.Array(CampaignHistory),
  reminderRules: Schema.Array(ReminderRule),
});
export type CommunicationCenter = typeof CommunicationCenter.Type;

export const AudienceSegment = Schema.Literals([
  "all_speakers",
  "confirmed",
  "awaiting_confirmation",
  "incomplete_tasks",
  "selected",
  "all_submitters",
  "awaiting_decision",
  "declined",
  "selected_submitters",
]);
export type AudienceSegment = typeof AudienceSegment.Type;

export const audienceMemberIds = (
  center: Pick<CommunicationCenter, "speakers" | "submitters">,
  segment: AudienceSegment,
  selectedIds: ReadonlySet<string> = new Set(),
) => {
  if (segment === "selected") {
    return center.speakers
      .filter((contact) => selectedIds.has(contact.id))
      .map((contact) => contact.id);
  }
  if (segment === "selected_submitters") {
    return center.submitters
      .filter((contact) => selectedIds.has(contact.id))
      .map((contact) => contact.id);
  }
  if (segment === "all_speakers") return center.speakers.map((contact) => contact.id);
  if (segment === "all_submitters") return center.submitters.map((contact) => contact.id);
  if (segment === "confirmed") {
    return center.speakers
      .filter((contact) => contact.confirmedAt !== null)
      .map((contact) => contact.id);
  }
  if (segment === "awaiting_confirmation") {
    return center.speakers
      .filter((contact) => contact.decisionInformed && contact.confirmedAt === null)
      .map((contact) => contact.id);
  }
  if (segment === "incomplete_tasks") {
    return center.speakers
      .filter((contact) => contact.taskIncomplete > 0)
      .map((contact) => contact.id);
  }
  if (segment === "awaiting_decision") {
    return center.submitters
      .filter((contact) =>
        contact.submissions.some(
          (submission) => submission.status === "pending" || submission.status === "maybe",
        ),
      )
      .map((contact) => contact.id);
  }
  // Declined is consolation mail: someone currently speaking never belongs in
  // it, even when another of their submissions was declined and informed.
  const speakerIds = new Set(center.speakers.map((contact) => contact.id));
  return center.submitters
    .filter(
      (contact) =>
        !speakerIds.has(contact.id) &&
        contact.submissions.some(
          (submission) => submission.status === "declined" && submission.notifiedAt !== null,
        ),
    )
    .map((contact) => contact.id);
};

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

// The exact frame campaigns ship in — the composer and campaign pages preview
// through the same render the send path uses, so what you see is what sends.
export const renderCampaignEmail = (input: {
  readonly eventName: string;
  readonly logoUrl: string | null;
  readonly subject: string;
  readonly body: string;
}) =>
  outreach({
    eventName: input.eventName,
    logoUrl: input.logoUrl,
    subject: input.subject,
    bodyHtml: freeformToHtml(input.body),
    bodyText: input.body,
  });

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
  // Per recipient because each carries their own portal access token.
  readonly recipients: ReadonlyArray<CampaignRecipientSource & { readonly portalUrl: string }>;
}) =>
  input.recipients.map((recipient) => {
    const fields = {
      speaker_name: recipient.speakerName,
      talk_title: recipient.talkTitle,
      event_name: input.eventName,
      portal_url: recipient.portalUrl,
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
  replyTo: NullableString,
  recipientFilter: JsonObject,
  segment: AudienceSegment,
  contactIds: Schema.Array(Schema.String),
});

export const ReminderRuleMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: NullableString,
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
