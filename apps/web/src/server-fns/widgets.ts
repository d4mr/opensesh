import {
  PublicProgramRequest,
  SpeakerCsvImportRequest,
  WidgetCreateRequest,
  WidgetListRequest,
  WidgetRequest,
  WidgetUpdateRequest,
} from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { buildCalendarInvite } from "@opensesh/domain/server/mail/ics";
import { Events, Widgets } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireEvent = Effect.fn("requireWidgetEvent")(function* (eventId: string) {
  const user = yield* getCurrentUser;
  const events = yield* Events;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId)
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  return event;
});

export const getPublicProgram = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PublicProgramRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const widgets = yield* Widgets;
        return yield* widgets.publicProgram(data.eventSlug);
      }),
    ),
  );

export const getPublicWidget = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(WidgetRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const widgets = yield* Widgets;
        return yield* widgets.publicWidget(data.embedId);
      }),
    ),
  );

export const listWidgets = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(WidgetListRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const widgets = yield* Widgets;
        return yield* widgets.list(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const createWidget = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(WidgetCreateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const widgets = yield* Widgets;
        return yield* widgets.create(
          data.eventId,
          data.name.trim() || "Untitled widget",
          data.view,
        );
      }),
      { require: "admin" },
    ),
  );

export const saveWidget = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(WidgetUpdateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const widgets = yield* Widgets;
        return yield* widgets.update({ ...data, name: data.name.trim() || "Untitled widget" });
      }),
      { require: "admin" },
    ),
  );

export const getSpeakerDirectory = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(WidgetListRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        const widgets = yield* Widgets;
        return yield* widgets.directory(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const importSpeakerCsv = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SpeakerCsvImportRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEvent(data.eventId);
        if (
          data.rows.some(
            (row) =>
              row.firstName.trim() === "" || row.lastName.trim() === "" || !row.email.includes("@"),
          )
        )
          return yield* Effect.fail(
            new InvalidInput({
              message: "Every row needs a first name, last name, and valid email",
            }),
          );
        const widgets = yield* Widgets;
        return yield* widgets.importSpeakers(data.eventId, data.rows);
      }),
      { require: "admin" },
    ),
  );

export const downloadPublicSessionIcs = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ eventSlug: Schema.String, code: Schema.String })),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    return runServer(
      Effect.gen(function* () {
        const widgets = yield* Widgets;
        const program = yield* widgets.publicProgram(data.eventSlug);
        const session = program.sessions.find((item) => item.code === data.code);
        if (
          session === undefined ||
          session.startsAt === null ||
          session.endsAt === null ||
          session.roomName === null
        )
          return yield* Effect.fail(
            new InvalidInput({ message: "This published session has no calendar slot" }),
          );
        return {
          filename: `${session.code.toLowerCase()}.ics`,
          content: buildCalendarInvite({
            id: session.id,
            title: session.title,
            startsAt: new Date(session.startsAt),
            endsAt: new Date(session.endsAt),
            timezone: program.event.timezone,
            room: session.roomName,
            description: session.description.replace(/<[^>]*>/g, ""),
            portalUrl: `${new URL(request.url).origin}/e/${program.event.slug}/sessions/${session.code}`,
            sequence: 0,
          }),
        };
      }),
    );
  });
