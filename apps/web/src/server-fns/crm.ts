import {
  CrmAddToEventRequest,
  CrmCampaignRequest,
  CrmCardMoveRequest,
  CrmCardMutationRequest,
  type CrmCsvContact,
  CrmContactMutationRequest,
  CrmContactRequest,
  CrmImportRequest,
  CrmMergeRequest,
  CrmNoteRequest,
  CrmRemoveTagRequest,
  CrmSegmentRequest,
  CrmStageDeleteRequest,
  CrmStageMutationRequest,
  CrmStageReorderRequest,
  CrmTagRequest,
  InvalidInput,
  normalizeCrmEmail,
} from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Crm, Events } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireCrm = Effect.fn("requireCrm")(function* () {
  const user = yield* getCurrentUser;
  const crm = yield* Crm;
  return { user, crm };
});

// Only surfaces that render org identity or write stage history need the
// organization row (one extra database round trip) — everything else
// authorizes on user.orgId alone.
const requireWorkspace = Effect.fn("requireCrmWorkspace")(function* () {
  const user = yield* getCurrentUser;
  const crm = yield* Crm;
  const organization = yield* crm.organization(user.orgId, user.userId);
  return { user, crm, organization };
});

const requiredText = (value: string, message: string) => {
  const trimmed = value.trim();
  return trimmed.length === 0
    ? Effect.fail(new InvalidInput({ message }))
    : Effect.succeed(trimmed);
};

const validEmail = (value: string) => {
  const email = normalizeCrmEmail(value);
  return email.includes("@") && email.split("@")[1]?.includes(".")
    ? Effect.succeed(email)
    : Effect.fail(new InvalidInput({ message: "Enter a valid email address" }));
};

export const getCrmWorkspace = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const { user, crm, organization } = yield* requireWorkspace();
      const [events, directory, tags, segments, pipeline, campaigns] = yield* Effect.all(
        [
          crm.listEvents(user.orgId),
          crm.directory(user.orgId),
          crm.listTags(user.orgId),
          crm.listSegments(user.orgId),
          crm.pipelineBoard(user.orgId),
          crm.listCampaigns(user.orgId),
        ],
        { concurrency: 6 },
      );
      return {
        organization: { id: organization.id, name: organization.name, logo: organization.logo },
        actorEventMemberId: organization.actorEventMemberId,
        events,
        directory,
        tags,
        segments,
        pipeline,
        campaigns,
      };
    }),
    { require: "admin" },
  ),
);

export const getCrmContact = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CrmContactRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        return yield* crm.contactDetailView(user.orgId, data.id);
      }),
      { require: "admin" },
    ),
  );

export const saveCrmContact = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmContactMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        const [firstName, lastName, email] = yield* Effect.all([
          requiredText(data.firstName, "First name is required"),
          requiredText(data.lastName, "Last name is required"),
          validEmail(data.email),
        ]);
        return yield* crm.saveContact(user.orgId, { ...data, firstName, lastName, email });
      }),
      { require: "admin" },
    ),
  );

export const addCrmNote = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmNoteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm, organization } = yield* requireWorkspace();
        yield* crm.contactDetailView(user.orgId, data.organizationContactId);
        const body = yield* requiredText(data.body, "Write a note before saving");
        return yield* crm.addNote(
          data.organizationContactId,
          body,
          organization.actorEventMemberId,
        );
      }),
      { require: "admin" },
    ),
  );

export const addCrmTag = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmTagRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        yield* crm.contactDetailView(user.orgId, data.organizationContactId);
        const name = yield* requiredText(data.name, "Tag name is required");
        return yield* crm.saveTag(user.orgId, data.organizationContactId, name);
      }),
      { require: "admin" },
    ),
  );

export const removeCrmTag = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmRemoveTagRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        yield* crm.contactDetailView(user.orgId, data.organizationContactId);
        return yield* crm.removeTag(data.organizationContactId, data.tagId);
      }),
      { require: "admin" },
    ),
  );

export const importCrmContacts = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmImportRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        if (data.rows.length === 0)
          return yield* Effect.fail(
            new InvalidInput({ message: "Map and preview at least one row" }),
          );
        const skipped = data.rows.filter(
          (row) => row.firstName.trim().length === 0 || row.lastName.trim().length === 0,
        ).length;
        const rows: Array<CrmCsvContact> = [];
        for (const row of data.rows) {
          if (row.firstName.trim().length === 0 || row.lastName.trim().length === 0) continue;
          const email = yield* validEmail(row.email);
          rows.push({
            ...row,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            email,
          });
        }
        if (rows.length === 0) return { created: 0, updated: 0, skipped, outcomes: [] };
        const result = yield* crm.importContacts(user.orgId, rows, data.behavior);
        return { ...result, skipped: result.skipped + skipped };
      }),
      { require: "admin" },
    ),
  );

export const saveCrmSegment = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmSegmentRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        const name = yield* requiredText(data.name, "Segment name is required");
        return yield* crm.saveSegment(user.orgId, name, data.filter);
      }),
      { require: "admin" },
    ),
  );

export const saveCrmStage = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmStageMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        const name = yield* requiredText(data.name, "Stage name is required");
        return yield* crm.saveStage({ ...data, organizationId: user.orgId, name });
      }),
      { require: "admin" },
    ),
  );

export const deleteCrmStage = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmStageDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        return yield* crm.deleteStage(user.orgId, data.id);
      }),
      { require: "admin" },
    ),
  );

export const reorderCrmStages = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmStageReorderRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        return yield* crm.reorderStages(user.orgId, data.stageIds);
      }),
      { require: "admin" },
    ),
  );

export const saveCrmCard = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmCardMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm, organization } = yield* requireWorkspace();
        return yield* crm.saveCard(
          user.orgId,
          data.organizationContactId,
          data.stageId,
          data.note,
          organization.actorEventMemberId,
        );
      }),
      { require: "admin" },
    ),
  );

export const moveCrmCard = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmCardMoveRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm, organization } = yield* requireWorkspace();
        return yield* crm.moveCard(
          user.orgId,
          data.cardId,
          data.toStageId,
          organization.actorEventMemberId,
        );
      }),
      { require: "admin" },
    ),
  );

export const mergeCrmContacts = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmMergeRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        return yield* crm.merge(user.orgId, data.primaryId, data.duplicateId);
      }),
      { require: "admin" },
    ),
  );

export const addCrmContactToEvent = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmAddToEventRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm } = yield* requireCrm();
        yield* crm.contactDetailView(user.orgId, data.organizationContactId);
        const events = yield* Events;
        const event = yield* events.get(data.eventId);
        if (event.organizationId !== user.orgId)
          return yield* Effect.fail(new InvalidInput({ message: "Choose an organization event" }));
        return yield* crm.addToEvent(
          data.organizationContactId,
          data.eventId,
          data.participation,
          "invited",
        );
      }),
      { require: "admin" },
    ),
  );

export const sendCrmCampaign = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CrmCampaignRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user, crm, organization } = yield* requireWorkspace();
        const events = yield* Events;
        const event = yield* events.get(data.eventId);
        if (event.organizationId !== user.orgId)
          return yield* Effect.fail(new InvalidInput({ message: "Choose an organization event" }));
        const subject = yield* requiredText(data.subject, "Subject is required");
        const body = yield* requiredText(data.body, "Message is required");
        if (data.organizationContactIds.length === 0)
          return yield* Effect.fail(new InvalidInput({ message: "Select at least one contact" }));
        if (data.addToEvent)
          yield* Effect.forEach(
            data.organizationContactIds,
            (organizationContactId) =>
              crm.addToEvent(organizationContactId, data.eventId, "speaker", "invited"),
            { concurrency: 5 },
          );
        const created = yield* crm.createCampaign({
          eventId: data.eventId,
          templateId: null,
          subject,
          body,
          recipientFilter: {
            source: "crm",
            organizationContactIds: data.organizationContactIds,
          },
          createdByEventMemberId: organization.actorEventMemberId,
          organizationContactIds: data.organizationContactIds,
        });
        const campaign = yield* crm.sendCampaign(created.campaign.id);
        return { campaign, recipients: created.recipients, sent: created.recipients.length };
      }),
      { require: "admin" },
    ),
  );
