import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Agenda } from "@opensesh/domain/server/repos";
import {
  AcceptAgendaDraftResult,
  AgendaAdminData,
  AgendaDraft,
} from "@opensesh/domain/server/schema/agenda";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const ScheduleBody = Schema.Struct({
  submissionId: Schema.String,
  roomId: Schema.NullOr(Schema.String),
  startsAt: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.String),
});

const GenerateDraftBody = Schema.Struct({
  name: Schema.String,
  criteria: Schema.Struct({
    days: Schema.Array(Schema.String),
    roomIds: Schema.Array(Schema.String),
    includeStatuses: Schema.Array(Schema.Literals(["accepted", "maybe"])),
    respectExistingPlacements: Schema.Boolean,
    rules: Schema.Array(Schema.String),
  }),
});

const DraftActionBody = Schema.Struct({ action: Schema.Literals(["duplicate", "discard"]) });
const AcceptDraftBody = Schema.Struct({ submissionIds: Schema.Array(Schema.String) });

export const agendaEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/agenda",
    operationId: "getAgenda",
    summary: "Get the agenda",
    description: "Rooms, scheduled and unscheduled sessions, conflicts, and publication state.",
    tag: "Agenda",
    successSchema: AgendaAdminData,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.admin(access.event.id);
      }),
  }),
  endpoint({
    method: "PUT",
    path: "/events/{eventId}/agenda/schedule",
    operationId: "scheduleSession",
    summary: "Place or clear a session on the schedule",
    description: "Pass roomId/startsAt/endsAt as null to unschedule the session.",
    tag: "Agenda",
    bodySchema: ScheduleBody,
    successSchema: AgendaAdminData,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ScheduleBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.saveSchedule({ ...body, eventId: access.event.id });
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/agenda/publish",
    operationId: "publishAgenda",
    summary: "Publish the agenda",
    tag: "Agenda",
    successSchema: AgendaAdminData,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.publish(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/agenda/unpublish",
    operationId: "unpublishAgenda",
    summary: "Unpublish the agenda",
    tag: "Agenda",
    successSchema: AgendaAdminData,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.unpublish(access.event.id);
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/agenda/drafts",
    operationId: "listAgendaDrafts",
    summary: "List AI agenda drafts",
    tag: "Agenda",
    successSchema: Schema.Array(AgendaDraft),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.listDrafts(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/agenda/drafts",
    operationId: "generateAgendaDraft",
    summary: "Generate an AI agenda draft",
    description:
      "Anthropic-backed schedule proposal from your criteria and free-text rules (max 12). Requires ANTHROPIC_API_KEY on the deployment.",
    tag: "Agenda",
    bodySchema: GenerateDraftBody,
    successStatus: 201,
    successSchema: AgendaDraft,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof GenerateDraftBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.generateDraft({
          eventId: access.event.id,
          name: body.name,
          criteria: body.criteria,
        });
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/agenda/drafts/{draftId}",
    operationId: "changeAgendaDraft",
    summary: "Duplicate or discard a draft",
    tag: "Agenda",
    bodySchema: DraftActionBody,
    successSchema: AgendaDraft,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof DraftActionBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.changeDraft({
          eventId: access.event.id,
          draftId: context.params.draftId ?? "",
          action: body.action,
        });
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/agenda/drafts/{draftId}/accept",
    operationId: "acceptAgendaDraft",
    summary: "Accept placements from a draft",
    description:
      "Applies the draft's placements for the given submission ids to the live schedule.",
    tag: "Agenda",
    bodySchema: AcceptDraftBody,
    successSchema: AcceptAgendaDraftResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof AcceptDraftBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const agenda = yield* Agenda;
        return yield* agenda.acceptDraft({
          eventId: access.event.id,
          draftId: context.params.draftId ?? "",
          submissionIds: body.submissionIds,
        });
      }),
  }),
];
