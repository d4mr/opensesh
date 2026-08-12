import {
  CampaignSendRequest,
  CommunicationCenterRequest,
  EmailTemplateDeleteRequest,
  EmailTemplateMutationRequest,
  PortalInvitationRequest,
  ReminderRuleMutationRequest,
  ReminderRuleRunRequest,
  SpeakerHeadshotUploadRequest,
  SpeakerProfileMutationRequest,
  SpeakerWorkflowMutationRequest,
  campaignMergeTokens,
} from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { DbError, Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import { Contacts, Portal, SpeakerComms } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireEvent = (eventId: string) => requireEventAccess(eventId, "admin");

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const requiredText = (value: string, message: string) =>
  value.trim().length === 0
    ? Effect.fail(new InvalidInput({ message }))
    : Effect.succeed(value.trim());

export const getCommunicationCenter = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CommunicationCenterRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const communications = yield* SpeakerComms;
        return yield* communications.center(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const saveAdminSpeaker = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SpeakerProfileMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireEvent(data.eventId);
        const [firstName, lastName] = yield* Effect.all([
          requiredText(data.firstName, "Enter the speaker's first name"),
          requiredText(data.lastName, "Enter the speaker's last name"),
        ]);
        if (!data.email.includes("@"))
          return yield* Effect.fail(new InvalidInput({ message: "Enter a valid email" }));
        const communications = yield* SpeakerComms;
        return yield* communications.saveSpeaker(
          { ...data, firstName, lastName, email: data.email.trim().toLowerCase() },
          { kind: "user", userId: user.userId, name: user.name },
        );
      }),
      { require: "staff" },
    ),
  );

export const setSpeakerWorkflowStatus = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SpeakerWorkflowMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const communications = yield* SpeakerComms;
        return yield* communications.setWorkflowStatus(
          data.eventId,
          data.contactId,
          data.workflowStatus,
        );
      }),
      { require: "staff" },
    ),
  );

export const uploadAdminSpeakerHeadshot = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SpeakerHeadshotUploadRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return runServer(
      Effect.gen(function* () {
        const { user } = yield* requireEvent(data.eventId);
        const contacts = yield* Contacts;
        const contact = yield* contacts.get(data.contactId);
        if (contact.eventId !== data.eventId)
          return yield* Effect.fail(
            new Forbidden({ message: "This speaker does not belong to the event" }),
          );
        if (data.size > 8 * 1024 * 1024)
          return yield* Effect.fail(
            new InvalidInput({ message: "Headshots must be 8 MB or smaller" }),
          );
        if (!data.contentType.startsWith("image/"))
          return yield* Effect.fail(new InvalidInput({ message: "Choose an image file" }));
        const bytes = decodeBase64(data.base64);
        if (bytes.byteLength !== data.size)
          return yield* Effect.fail(
            new InvalidInput({ message: "The uploaded headshot is incomplete" }),
          );
        const portal = yield* Portal;
        const prepared = yield* portal.prepareAdminHeadshot(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.contactId,
        );
        const storageKey = `${data.contactId}/${prepared.fileUploadId}/${crypto.randomUUID()}`;
        yield* Effect.tryPromise({
          try: () =>
            env.FILES.put(storageKey, bytes, {
              httpMetadata: {
                contentType: data.contentType,
                contentDisposition: `attachment; filename="${data.filename.replaceAll('"', "")}"`,
              },
            }),
          catch: (cause) => new DbError({ message: "Could not store the headshot", cause }),
        });
        return yield* portal.recordFileVersion({
          fileUploadId: prepared.fileUploadId,
          storageKey,
          filename: data.filename,
          contentType: data.contentType,
          size: data.size,
          uploaderContactId: null,
          uploaderUserId: prepared.uploaderUserId,
          headshotContactId: data.contactId,
          adminApproved: true,
          completeAssignmentId: null,
        });
      }),
      { require: "staff" },
    );
  });

export const inviteSpeakerPortals = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalInvitationRequest))
  .handler(async ({ data }) => {
    const origin = new URL(getRequest().url).origin;
    return runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        if (data.contactIds.length === 0)
          return yield* Effect.fail(new InvalidInput({ message: "Choose at least one speaker" }));
        const communications = yield* SpeakerComms;
        const mail = yield* Mail;
        const invitations = yield* communications.queuePortalInvitations(
          data.eventId,
          data.contactIds,
          origin,
        );
        const logIds = invitations.flatMap((invitation) =>
          invitation.logId === null ? [] : [invitation.logId],
        );
        yield* Effect.forEach(logIds, (logId) => mail.sendQueued(logId), { concurrency: 5 });
        return { invitations, sent: logIds.length };
      }),
      { require: "staff" },
    );
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EmailTemplateMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        yield* Effect.all([
          requiredText(data.name, "Enter a template name"),
          requiredText(data.subjectTemplate, "Enter a subject"),
          requiredText(data.bodyTemplate, "Enter a message"),
        ]);
        const tokens = data.subjectTemplate
          .concat(data.bodyTemplate)
          .match(/\{([^}]+)\}/g)
          ?.map((token) => token.slice(1, -1));
        const unsupported = tokens?.find(
          (token) => !campaignMergeTokens.some((supported) => supported === token),
        );
        if (unsupported !== undefined)
          return yield* Effect.fail(
            new InvalidInput({ message: `Unsupported merge token {${unsupported}}` }),
          );
        const communications = yield* SpeakerComms;
        return yield* communications.saveTemplate(data);
      }),
      { require: "staff" },
    ),
  );

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EmailTemplateDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const communications = yield* SpeakerComms;
        return yield* communications.deleteTemplate(data.eventId, data.id);
      }),
      { require: "staff" },
    ),
  );

export const sendSpeakerCampaign = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CampaignSendRequest))
  .handler(async ({ data }) => {
    const origin = new URL(getRequest().url).origin;
    return runServer(
      Effect.gen(function* () {
        const { user } = yield* requireEvent(data.eventId);
        yield* Effect.all([
          requiredText(data.subject, "Enter a campaign subject"),
          requiredText(data.body, "Enter a campaign message"),
        ]);
        const communications = yield* SpeakerComms;
        const mail = yield* Mail;
        const queued = yield* communications.createCampaign({
          ...data,
          actor: { kind: "user", userId: user.userId, name: user.name },
          portalOrigin: origin,
        });
        const results = yield* Effect.forEach(queued.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        const campaign = yield* communications.completeCampaign(queued.campaignId);
        return {
          campaign,
          sent: results.filter((result) => result.status !== "failed").length,
          failed: results.filter((result) => result.status === "failed").length,
        };
      }),
      { require: "staff" },
    );
  });

export const saveTaskReminderRule = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReminderRuleMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        if (!Number.isInteger(data.daysBeforeDue) || data.daysBeforeDue < 0)
          return yield* Effect.fail(
            new InvalidInput({ message: "Days before due must be zero or more" }),
          );
        const communications = yield* SpeakerComms;
        return yield* communications.saveReminderRule(
          data.eventId,
          data.id,
          data.daysBeforeDue,
          data.enabled,
        );
      }),
      { require: "staff" },
    ),
  );

export const runTaskReminderRule = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReminderRuleRunRequest))
  .handler(async ({ data }) => {
    const origin = new URL(getRequest().url).origin;
    return runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const communications = yield* SpeakerComms;
        const mail = yield* Mail;
        const queued = yield* communications.queueReminderRule(
          data.eventId,
          data.id,
          origin,
          new Date(),
        );
        const results = yield* Effect.forEach(queued.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        return {
          skippedAsDuplicate: queued.skippedAsDuplicate,
          sent: results.filter((result) => result.status !== "failed").length,
          failed: results.filter((result) => result.status === "failed").length,
        };
      }),
      { require: "staff" },
    );
  });
