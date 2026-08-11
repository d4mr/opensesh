import { WidgetOptions } from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { NotFound } from "@opensesh/domain/server/errors";
import { Events, MailAdmin, Widgets } from "@opensesh/domain/server/repos";
import { Effect, Schema } from "effect";

import type { ApiEndpoint } from "../types";

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
  {
    method: "GET",
    path: "/events/{eventId}/program",
    operationId: "getProgram",
    summary: "Get the published program",
    description:
      "The public program feed: accepted sessions with approved content, speakers, tracks, and the published agenda. Same data the embeds render.",
    tag: "Widgets",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        const event = yield* events.get(access.event.id);
        const widgets = yield* Widgets;
        return yield* widgets.publicProgram(event.slug);
      }),
  },
  {
    method: "GET",
    path: "/events/{eventId}/widgets",
    operationId: "listWidgets",
    summary: "List embed widgets",
    tag: "Widgets",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.list(access.event.id);
      }),
  },
  {
    method: "POST",
    path: "/events/{eventId}/widgets",
    operationId: "createWidget",
    summary: "Create an embed widget",
    tag: "Widgets",
    bodySchema: WidgetCreateBody,
    successStatus: 201,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof WidgetCreateBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const widgets = yield* Widgets;
        return yield* widgets.create(access.event.id, body.name, body.view);
      }),
  },
  {
    method: "PATCH",
    path: "/events/{eventId}/widgets/{widgetId}",
    operationId: "updateWidget",
    summary: "Update an embed widget",
    description:
      "Full widget update: name, view, enabled flag, and every option (filters, theme, visible fields, custom CSS).",
    tag: "Widgets",
    bodySchema: WidgetUpdateBody,
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
  },
  {
    method: "GET",
    path: "/events/{eventId}/emails",
    operationId: "listEmails",
    summary: "List sent and queued emails",
    description: "The event's full email log — decisions, reminders, invites, campaigns.",
    tag: "Mail",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const mailAdmin = yield* MailAdmin;
        return yield* mailAdmin.list(access.event.id);
      }),
  },
];
