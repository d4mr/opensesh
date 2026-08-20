import { SpeakerCsvRow } from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { SpeakerComms, Widgets } from "@opensesh/domain/server/repos";
import {
  AudienceSegment,
  CommunicationCenter,
  PortalInvitationResult,
} from "@opensesh/domain/server/schema/communications";
import { Contact } from "@opensesh/domain/server/schema/submissions";
import { SpeakerDirectory } from "@opensesh/domain/server/schema/widgets";
import { Effect, Schema } from "effect";

import { MailQueue } from "../../mail-queue";
import { endpoint, type ApiEndpoint } from "../types";

const SpeakerBody = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  linkedinUrl: Schema.NullOr(Schema.String),
  twitterUrl: Schema.NullOr(Schema.String),
  websiteUrl: Schema.NullOr(Schema.String),
  dietaryRequirements: Schema.Literals(["none", "vegetarian", "vegan", "gluten_free", "other"]),
  tshirtSize: Schema.NullOr(Schema.Literals(["XS", "S", "M", "L", "XL", "XXL"])),
  travelLogistics: Schema.NullOr(Schema.String),
});

const SpeakerImportBody = Schema.Struct({ rows: Schema.Array(SpeakerCsvRow) });
const InviteBody = Schema.Struct({ contactIds: Schema.Array(Schema.String) });
const CampaignBody = Schema.Struct({
  templateId: Schema.NullOr(Schema.String),
  subject: Schema.String,
  body: Schema.String,
  replyTo: Schema.optionalKey(Schema.NullOr(Schema.String)),
  contactIds: Schema.Array(Schema.String),
  segment: AudienceSegment,
});

export const speakerEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/speakers",
    operationId: "listSpeakers",
    summary: "List event speakers",
    description:
      "The speaker directory: derived pipeline, profile readiness, task progress, and sessions per speaker.",
    tag: "Speakers",
    successSchema: SpeakerDirectory,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.directory(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/speakers",
    operationId: "saveSpeaker",
    summary: "Create or update a speaker",
    description: "Pass id: null to create; an existing contact id updates that speaker.",
    tag: "Speakers",
    bodySchema: SpeakerBody,
    successStatus: 201,
    successSchema: Contact,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SpeakerBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const firstName = body.firstName.trim();
        const lastName = body.lastName.trim();
        if (firstName === "" || lastName === "") {
          return yield* Effect.fail(
            new InvalidInput({ message: "Enter the speaker's first and last name" }),
          );
        }
        if (!body.email.includes("@")) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a valid email" }));
        }
        const communications = yield* SpeakerComms;
        return yield* communications.saveSpeaker(
          {
            ...body,
            eventId: access.event.id,
            firstName,
            lastName,
            email: body.email.trim().toLowerCase(),
          },
          context.actor,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/speakers/import",
    operationId: "importSpeakers",
    summary: "Bulk import speakers",
    description:
      'Rich per-row import (profile, socials, dietary, t-shirt) with per-row action: "create", "update", or "skip".',
    tag: "Speakers",
    bodySchema: SpeakerImportBody,
    successSchema: Schema.Struct({
      created: Schema.Number,
      updated: Schema.Number,
      skipped: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SpeakerImportBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (body.rows.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Pass at least one row" }));
        }
        if (
          body.rows.some(
            (row) =>
              row.firstName.trim() === "" || row.lastName.trim() === "" || !row.email.includes("@"),
          )
        ) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Every row needs a first name, last name, and email" }),
          );
        }
        const widgets = yield* Widgets;
        return yield* widgets.importSpeakers(access.event.id, body.rows);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/speakers/invite",
    operationId: "inviteSpeakerPortals",
    summary: "Invite speakers to their portal",
    description: "Queues portal invitation emails for the given event contacts.",
    tag: "Speakers",
    bodySchema: InviteBody,
    successSchema: Schema.Struct({
      invitations: Schema.Array(PortalInvitationResult),
      queued: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof InviteBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (body.contactIds.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Choose at least one speaker" }));
        }
        const communications = yield* SpeakerComms;
        const invitations = yield* communications.queuePortalInvitations(
          access.event.id,
          body.contactIds,
          "https://app.opensesh.io",
        );
        const logIds = invitations.flatMap((invitation) =>
          invitation.logId === null ? [] : [invitation.logId],
        );
        const queue = yield* MailQueue;
        yield* queue.enqueue(logIds);
        return { invitations, queued: logIds.length };
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/communications",
    operationId: "getCommunications",
    summary: "Get the communication center",
    description: "Templates, campaign history, reminder rules, and per-speaker email history.",
    tag: "Mail",
    successSchema: CommunicationCenter,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const communications = yield* SpeakerComms;
        return yield* communications.center(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/campaigns",
    operationId: "sendCampaign",
    summary: "Send a speaker campaign",
    description:
      "Queues a templated or free-form email to eligible contacts in the chosen audience and records the campaign.",
    tag: "Mail",
    bodySchema: CampaignBody,
    successStatus: 201,
    successSchema: Schema.Struct({
      campaignId: Schema.String,
      queued: Schema.Number,
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof CampaignBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (body.subject.trim() === "" || body.body.trim() === "") {
          return yield* Effect.fail(
            new InvalidInput({ message: "Enter a campaign subject and message" }),
          );
        }
        if (body.contactIds.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Choose at least one recipient" }));
        }
        const communications = yield* SpeakerComms;
        const queued = yield* communications.createCampaign({
          eventId: access.event.id,
          templateId: body.templateId,
          subject: body.subject,
          body: body.body,
          replyTo: body.replyTo?.trim() || null,
          recipientFilter: { segment: body.segment },
          segment: body.segment,
          contactIds: body.contactIds,
          actor: context.actor,
          portalOrigin: "https://app.opensesh.io",
        });
        const queue = yield* MailQueue;
        yield* queue.enqueue(queued.logIds);
        return { campaignId: queued.campaignId, queued: queued.logIds.length };
      }),
  }),
];
