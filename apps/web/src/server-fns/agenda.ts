import {
  AgendaPublicationRequest,
  AgendaRequest,
  PublicAgendaRequest,
  ScheduleChange,
} from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Forbidden } from "@opensesh/domain/server/errors";
import { Agenda, Events } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireAgendaEvent = Effect.fn("requireAgendaEvent")(function* (eventId: string) {
  const events = yield* Events;
  const user = yield* getCurrentUser;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  }
  return event;
});

export const getAgenda = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(AgendaRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const agenda = yield* Agenda;
        yield* requireAgendaEvent(data.eventId);
        return yield* agenda.admin(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const saveAgendaSchedule = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ScheduleChange))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const agenda = yield* Agenda;
        yield* requireAgendaEvent(data.eventId);
        return yield* agenda.saveSchedule(data);
      }),
      { require: "admin" },
    ),
  );

export const changeAgendaPublication = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AgendaPublicationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const agenda = yield* Agenda;
        yield* requireAgendaEvent(data.eventId);
        return data.action === "publish"
          ? yield* agenda.publish(data.eventId)
          : yield* agenda.unpublish(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const getPublicAgenda = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PublicAgendaRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const agenda = yield* Agenda;
        return yield* agenda.public(data.eventSlug);
      }),
    ),
  );
