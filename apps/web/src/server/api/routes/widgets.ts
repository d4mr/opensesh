import { WidgetOptions } from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { NotFound } from "@opensesh/domain/server/errors";
import { Events, MailAdmin, Widgets } from "@opensesh/domain/server/repos";
import { AdminEmail } from "@opensesh/domain/server/schema/mail";
import { PublicProgram, Widget } from "@opensesh/domain/server/schema/widgets";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const WidgetView = Schema.Literals([
  "sessions",
  "speakers",
  "speaker_gallery",
  "agenda",
  "itinerary",
]);

const WidgetCreateBody = Schema.Struct({ name: Schema.String, view: WidgetView });
const WidgetUpdateBody = Schema.Struct({
  name: Schema.String,
  view: WidgetView,
  enabled: Schema.Boolean,
  options: WidgetOptions,
});

export const widgetEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/program",
    operationId: "getProgram",
    summary: "Get the published program",
    description:
      "The public program feed: accepted sessions with approved content, speakers, tracks, and the published agenda. Same data the embeds render.",
    tag: "Widgets",
    successSchema: PublicProgram,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        const event = yield* events.get(access.event.id);
        const widgets = yield* Widgets;
        return yield* widgets.publicProgram(event.slug);
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/widgets",
    operationId: "listWidgets",
    summary: "List embed widgets",
    tag: "Widgets",
    successSchema: Schema.Array(Widget),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.list(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/widgets",
    operationId: "createWidget",
    summary: "Create an embed widget",
    tag: "Widgets",
    bodySchema: WidgetCreateBody,
    successStatus: 201,
    successSchema: Widget,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof WidgetCreateBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.create(access.event.id, body.name, body.view);
      }),
  }),
  endpoint({
    method: "PATCH",
    path: "/events/{eventId}/widgets/{widgetId}",
    operationId: "updateWidget",
    summary: "Update an embed widget",
    description:
      "Full widget update: name, view, enabled flag, and every option (filters, theme, visible fields, custom CSS).",
    tag: "Widgets",
    bodySchema: WidgetUpdateBody,
    successSchema: Widget,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof WidgetUpdateBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        const existing = yield* widgets.list(access.event.id);
        const widget = existing.find((item) => item.id === context.params.widgetId);
        if (widget === undefined) {
          return yield* Effect.fail(new NotFound({ message: "Widget not found in this event" }));
        }
        return yield* widgets.update({
          id: widget.id,
          eventId: access.event.id,
          name: body.name,
          view: body.view,
          enabled: body.enabled,
          options: body.options,
        });
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/emails",
    operationId: "listEmails",
    summary: "List sent and queued emails",
    description: "The event's full email log — decisions, reminders, invites, campaigns.",
    tag: "Mail",
    successSchema: Schema.Array(AdminEmail),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const mailAdmin = yield* MailAdmin;
        return yield* mailAdmin.list(access.event.id);
      }),
  }),
];
