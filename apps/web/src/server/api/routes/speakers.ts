import { SpeakerCsvRow } from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import { SpeakerComms, Widgets } from "@opensesh/domain/server/repos";
import { Effect, Schema } from "effect";

import type { ApiEndpoint } from "../types";

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
  workflowStatus: Schema.Literals(["invited", "onboarding", "confirmed", "ready", "declined"]),
});

const WorkflowBody = Schema.Struct({
  status: Schema.Literals(["invited", "onboarding", "confirmed", "ready", "declined"]),
});

const SpeakerImportBody = Schema.Struct({ rows: Schema.Array(SpeakerCsvRow) });
const InviteBody = Schema.Struct({ contactIds: Schema.Array(Schema.String) });
const CampaignBody = Schema.Struct({
  templateId: Schema.NullOr(Schema.String),
  subject: Schema.String,
  body: Schema.String,
  contactIds: Schema.Array(Schema.String),
});

export const speakerEndpoints: ReadonlyArray<ApiEndpoint> = [
  {
    method: "GET",
    path: "/events/{eventId}/speakers",
    operationId: "listSpeakers",
    summary: "List event speakers",
    description:
      "The speaker directory: profile readiness, workflow status, task progress, and sessions per speaker.",
    tag: "Speakers",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.directory(access.event.id);
      }),
  },
  {
    method: "POST",
    path: "/events/{eventId}/speakers",
    operationId: "saveSpeaker",
    summary: "Create or update a speaker",
    description: "Pass id: null to create; an existing contact id updates that speaker.",
    tag: "Speakers",
    bodySchema: SpeakerBody,
    successStatus: 201,
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
          { userId: context.principal.keyId, name: `API key: ${context.principal.keyName}` },
        );
      }),
  },
  {
    method: "PATCH",
    path: "/events/{eventId}/speakers/{contactId}/workflow",
    operationId: "setSpeakerWorkflow",
    summary: "Set a speaker's workflow status",
    tag: "Speakers",
    bodySchema: WorkflowBody,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof WorkflowBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const communications = yield* SpeakerComms;
        return yield* communications.setWorkflowStatus(
          access.event.id,
          context.params.contactId ?? "",
          body.status,
        );
      }),
  },
  {
    method: "POST",
    path: "/events/{eventId}/speakers/import",
    operationId: "importSpeakers",
    summary: "Bulk import speakers",
    description:
      'Rich per-row import (profile, socials, dietary, t-shirt) with per-row action: "create", "update", or "skip".',
    tag: "Speakers",
    bodySchema: SpeakerImportBody,
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
  },
  {
    method: "POST",
    path: "/events/{eventId}/speakers/invite",
    operationId: "inviteSpeakerPortals",
    summary: "Invite speakers to their portal",
    description: "Queues and sends portal invitation emails for the given event contacts.",
    tag: "Speakers",
    bodySchema: InviteBody,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof InviteBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (body.contactIds.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Choose at least one speaker" }));
        }
        const communications = yield* SpeakerComms;
        const mail = yield* Mail;
        const invitations = yield* communications.queuePortalInvitations(
          access.event.id,
          body.contactIds,
          "https://app.opensesh.io",
        );
        const logIds = invitations.flatMap((invitation) =>
          invitation.logId === null ? [] : [invitation.logId],
        );
        yield* Effect.forEach(logIds, (logId) => mail.sendQueued(logId), { concurrency: 5 });
        return { invitations, sent: logIds.length };
      }),
  },
  {
    method: "GET",
    path: "/events/{eventId}/communications",
    operationId: "getCommunications",
    summary: "Get the communication center",
    description: "Templates, campaign history, reminder rules, and per-speaker email history.",
    tag: "Mail",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const communications = yield* SpeakerComms;
        return yield* communications.center(access.event.id);
      }),
  },
  {
    method: "POST",
    path: "/events/{eventId}/campaigns",
    operationId: "sendCampaign",
    summary: "Send a speaker campaign",
    description:
      "Sends a templated or free-form email to the given event contacts and records the campaign.",
    tag: "Mail",
    bodySchema: CampaignBody,
    successStatus: 201,
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
        const mail = yield* Mail;
        const queued = yield* communications.createCampaign({
          eventId: access.event.id,
          templateId: body.templateId,
          subject: body.subject,
          body: body.body,
          recipientFilter: {},
          contactIds: body.contactIds,
          createdByUserId: context.principal.keyId,
          portalOrigin: "https://app.opensesh.io",
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
  },
];
