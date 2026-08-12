import { normalizeCrmEmail } from "@opensesh/domain";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Crm } from "@opensesh/domain/server/repos";
import {
  CrmContactDetailView,
  CrmDirectoryRow,
  CrmImportResult,
  CrmPipelineBoard,
  CrmPipelineCard,
  CrmPipelineStage,
  CrmSegment,
  OrganizationContact,
  OrganizationContactEvent,
  OrganizationContactNote,
  OrganizationTag,
} from "@opensesh/domain/server/schema/crm";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const ContactBody = Schema.Struct({
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  title: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  linkedinUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  twitterUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  facebookUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  websiteUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  headshotUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const ImportBody = Schema.Struct({
  behavior: Schema.Literals(["update", "skip"]),
  rows: Schema.Array(
    Schema.Struct({
      firstName: Schema.String,
      lastName: Schema.String,
      email: Schema.String,
      title: Schema.NullOr(Schema.String),
      company: Schema.NullOr(Schema.String),
      bio: Schema.NullOr(Schema.String),
    }),
  ),
});

const TagBody = Schema.Struct({ name: Schema.String });
const NoteBody = Schema.Struct({ body: Schema.String });
const AddToEventBody = Schema.Struct({
  eventId: Schema.String,
  participation: Schema.Literals(["speaker", "organizer"]),
});
const MergeBody = Schema.Struct({ primaryId: Schema.String, duplicateId: Schema.String });
const StageBody = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  semanticStatus: Schema.Literals(["open", "won", "lost"]),
  position: Schema.Number,
});
const StageOrderBody = Schema.Struct({ stageIds: Schema.Array(Schema.String) });
const CardBody = Schema.Struct({
  organizationContactId: Schema.String,
  stageId: Schema.String,
  note: Schema.NullOr(Schema.String),
});
const MoveCardBody = Schema.Struct({ toStageId: Schema.String });
const SegmentBody = Schema.Struct({
  name: Schema.String,
  filter: Schema.Record(Schema.String, Schema.Json),
});

export const crmEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/contacts",
    operationId: "listContacts",
    summary: "List CRM contacts",
    description:
      "The organization-wide speaker CRM directory (contacts persist across events). Supports a q= substring filter on name, email, and company.",
    tag: "CRM",
    queryParams: [{ name: "q", description: "Case-insensitive filter on name, email, company." }],
    successSchema: Schema.Array(CrmDirectoryRow),
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        const rows = yield* crm.directory(context.principal.organizationId);
        const q = context.query.get("q")?.trim().toLowerCase() ?? "";
        if (q === "") return rows;
        return rows.filter((row) =>
          [
            row.contact.firstName,
            row.contact.lastName,
            row.contact.email,
            row.contact.company ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts",
    operationId: "createContact",
    summary: "Create a CRM contact",
    tag: "CRM",
    bodySchema: ContactBody,
    successStatus: 201,
    successSchema: OrganizationContact,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ContactBody.Type;
        const email = normalizeCrmEmail(body.email);
        if (!email.includes("@")) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a valid email" }));
        }
        const crm = yield* Crm;
        return yield* crm.saveContact(context.principal.organizationId, {
          id: null,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email,
          title: body.title,
          company: body.company,
          bio: body.bio,
          linkedinUrl: body.linkedinUrl ?? null,
          twitterUrl: body.twitterUrl ?? null,
          facebookUrl: body.facebookUrl ?? null,
          websiteUrl: body.websiteUrl ?? null,
          headshotUrl: body.headshotUrl ?? null,
          custom: {},
        });
      }),
  }),
  endpoint({
    method: "GET",
    path: "/contacts/{contactId}",
    operationId: "getContact",
    summary: "Get a CRM contact",
    description: "Full detail: profile, tags, notes, event participation, pipeline position.",
    tag: "CRM",
    successSchema: CrmContactDetailView,
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        return yield* crm.contactDetailView(
          context.principal.organizationId,
          context.params.contactId ?? "",
        );
      }),
  }),
  endpoint({
    method: "PATCH",
    path: "/contacts/{contactId}",
    operationId: "updateContact",
    summary: "Update a CRM contact",
    tag: "CRM",
    bodySchema: ContactBody,
    successSchema: OrganizationContact,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ContactBody.Type;
        const crm = yield* Crm;
        return yield* crm.saveContact(context.principal.organizationId, {
          id: context.params.contactId ?? "",
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email: normalizeCrmEmail(body.email),
          title: body.title,
          company: body.company,
          bio: body.bio,
          linkedinUrl: body.linkedinUrl ?? null,
          twitterUrl: body.twitterUrl ?? null,
          facebookUrl: body.facebookUrl ?? null,
          websiteUrl: body.websiteUrl ?? null,
          headshotUrl: body.headshotUrl ?? null,
          custom: {},
        });
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts/import",
    operationId: "importContacts",
    summary: "Bulk import contacts",
    description:
      'Idempotent by email. behavior: "update" refreshes existing contacts, "skip" leaves them untouched. Returns created/updated/skipped counts with a per-row outcome list.',
    tag: "CRM",
    bodySchema: ImportBody,
    successSchema: CrmImportResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ImportBody.Type;
        if (body.rows.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Pass at least one row" }));
        }
        const crm = yield* Crm;
        return yield* crm.importContacts(
          context.principal.organizationId,
          body.rows.map((row) => ({
            ...row,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            email: normalizeCrmEmail(row.email),
          })),
          body.behavior,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts/{contactId}/tags",
    operationId: "addContactTag",
    summary: "Tag a contact",
    tag: "CRM",
    bodySchema: TagBody,
    successStatus: 201,
    successSchema: OrganizationTag,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof TagBody.Type;
        const crm = yield* Crm;
        return yield* crm.saveTag(
          context.principal.organizationId,
          context.params.contactId ?? "",
          body.name,
        );
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/contacts/{contactId}/tags/{tagId}",
    operationId: "removeContactTag",
    summary: "Remove a tag from a contact",
    tag: "CRM",
    successStatus: 204,
    successSchema: Schema.Null,
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        yield* crm.removeTag(context.params.contactId ?? "", context.params.tagId ?? "");
        return null;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts/{contactId}/notes",
    operationId: "addContactNote",
    summary: "Add a note to a contact",
    tag: "CRM",
    bodySchema: NoteBody,
    successStatus: 201,
    successSchema: OrganizationContactNote,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof NoteBody.Type;
        const crm = yield* Crm;
        return yield* crm.addNote(
          context.params.contactId ?? "",
          body.body,
          context.principal.keyId,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts/{contactId}/events",
    operationId: "addContactToEvent",
    summary: "Link a contact to an event",
    description:
      "Copies the canonical CRM profile into the event as a speaker or organizer contact.",
    tag: "CRM",
    bodySchema: AddToEventBody,
    successStatus: 201,
    successSchema: OrganizationContactEvent,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AddToEventBody.Type;
        const crm = yield* Crm;
        return yield* crm.addToEvent(
          context.params.contactId ?? "",
          body.eventId,
          body.participation,
          "invited",
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/contacts/merge",
    operationId: "mergeContacts",
    summary: "Merge duplicate contacts",
    description:
      "Moves tags, notes, events, and pipeline history onto the primary, then deletes the duplicate.",
    tag: "CRM",
    bodySchema: MergeBody,
    successSchema: OrganizationContact,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof MergeBody.Type;
        const crm = yield* Crm;
        return yield* crm.merge(context.principal.organizationId, body.primaryId, body.duplicateId);
      }),
  }),
  endpoint({
    method: "GET",
    path: "/pipeline",
    operationId: "getPipeline",
    summary: "Get the pipeline board",
    description: "Stages with their cards, in board order.",
    tag: "Pipeline",
    successSchema: CrmPipelineBoard,
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        return yield* crm.pipelineBoard(context.principal.organizationId);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/pipeline/stages",
    operationId: "savePipelineStage",
    summary: "Create or update a pipeline stage",
    tag: "Pipeline",
    bodySchema: StageBody,
    successSchema: CrmPipelineStage,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof StageBody.Type;
        const crm = yield* Crm;
        return yield* crm.saveStage({
          id: body.id,
          organizationId: context.principal.organizationId,
          name: body.name,
          semanticStatus: body.semanticStatus,
          position: body.position,
        });
      }),
  }),
  endpoint({
    method: "PUT",
    path: "/pipeline/stages/order",
    operationId: "reorderPipelineStages",
    summary: "Reorder pipeline stages",
    tag: "Pipeline",
    bodySchema: StageOrderBody,
    successSchema: Schema.Struct({ ok: Schema.Literal(true) }),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof StageOrderBody.Type;
        const crm = yield* Crm;
        yield* crm.reorderStages(context.principal.organizationId, body.stageIds);
        return { ok: true } as const;
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/pipeline/stages/{stageId}",
    operationId: "deletePipelineStage",
    summary: "Delete a pipeline stage",
    tag: "Pipeline",
    successStatus: 204,
    successSchema: Schema.Null,
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        yield* crm.deleteStage(context.principal.organizationId, context.params.stageId ?? "");
        return null;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/pipeline/cards",
    operationId: "addPipelineCard",
    summary: "Add a contact to the pipeline",
    tag: "Pipeline",
    bodySchema: CardBody,
    successStatus: 201,
    successSchema: CrmPipelineCard,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof CardBody.Type;
        const crm = yield* Crm;
        return yield* crm.saveCard(
          context.principal.organizationId,
          body.organizationContactId,
          body.stageId,
          body.note,
          context.principal.keyId,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/pipeline/cards/{cardId}/move",
    operationId: "movePipelineCard",
    summary: "Move a card to another stage",
    tag: "Pipeline",
    bodySchema: MoveCardBody,
    successSchema: CrmPipelineCard,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof MoveCardBody.Type;
        const crm = yield* Crm;
        return yield* crm.moveCard(
          context.principal.organizationId,
          context.params.cardId ?? "",
          body.toStageId,
          context.principal.keyId,
        );
      }),
  }),
  endpoint({
    method: "GET",
    path: "/segments",
    operationId: "listSegments",
    summary: "List saved segments",
    tag: "CRM",
    successSchema: Schema.Array(CrmSegment),
    handler: (context) =>
      Effect.gen(function* () {
        const crm = yield* Crm;
        return yield* crm.listSegments(context.principal.organizationId);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/segments",
    operationId: "saveSegment",
    summary: "Save a dynamic segment",
    tag: "CRM",
    bodySchema: SegmentBody,
    successStatus: 201,
    successSchema: CrmSegment,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SegmentBody.Type;
        const crm = yield* Crm;
        return yield* crm.saveSegment(context.principal.organizationId, body.name, body.filter);
      }),
  }),
];
