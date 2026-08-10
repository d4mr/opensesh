import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Events, ReadModels } from "@opensesh/domain/server/repos";
import {
  EventSettingsRequest,
  LibraryDeleteRequest,
  LibraryMutationRequest,
  NewEventRequest,
} from "@opensesh/domain/server/schema/core";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer, runSessionServer } from "@/server/runtime";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const dateOrFail = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? Effect.fail(new InvalidInput({ message: "Enter valid event dates" }))
    : Effect.succeed(date);
};

const requireEvent = Effect.fn("requireAdminEvent")(function* (eventId: string) {
  const events = yield* Events;
  const user = yield* getCurrentUser;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  }
  return event;
});

export const getAdminBootstrap = createServerFn({ method: "GET" }).handler(async () =>
  runSessionServer((session, eventSlug) =>
    Effect.gen(function* () {
      const events = yield* Events;
      return yield* events.listForAdmin(session, eventSlug);
    }),
  ),
);

export const createEvent = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(NewEventRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const events = yield* Events;
        const user = yield* getCurrentUser;
        const [startsAt, endsAt, organizationEvents] = yield* Effect.all([
          dateOrFail(data.startsAt),
          dateOrFail(data.endsAt),
          events.listByOrganization(user.orgId),
        ]);
        const base = slugify(data.name) || "event";
        const slug = organizationEvents.some((event) => event.slug === base)
          ? `${base}-${organizationEvents.length + 1}`
          : base;
        return yield* events.createForAdmin(
          {
            organizationId: user.orgId,
            name: data.name,
            slug,
            tagline: null,
            description: null,
            type: "conference",
            websiteUrl: null,
            location: null,
            timezone: data.timezone,
            startsAt,
            endsAt,
            theme: null,
            logoUrl: null,
            backgroundUrl: null,
            defaultSubmissionLimit: 3,
            agendaPublishedAt: null,
            publishedAgenda: [],
            agendaDirty: false,
          },
          user.userId,
        );
      }),
      { require: "admin" },
    ),
  );

export const updateEventSettings = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EventSettingsRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const events = yield* Events;
        yield* requireEvent(data.eventId);
        const [startsAt, endsAt] = yield* Effect.all([
          dateOrFail(data.startsAt),
          dateOrFail(data.endsAt),
        ]);
        return yield* events.update(data.eventId, {
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          startsAt,
          endsAt,
          timezone: data.timezone,
          location: data.location,
        });
      }),
      { require: "admin" },
    ),
  );

export const getEventLibrary = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reads = yield* ReadModels;
        return yield* reads.eventLibraryForAdmin(session, eventSlug, data.eventId);
      }),
    ),
  );

export const saveLibraryItem = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(LibraryMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const events = yield* Events;
        yield* requireEvent(data.eventId);
        const list =
          data.kind === "track"
            ? yield* events.listTracks(data.eventId)
            : data.kind === "format"
              ? yield* events.listFormats(data.eventId)
              : data.kind === "room"
                ? yield* events.listRooms(data.eventId)
                : data.kind === "tag"
                  ? yield* events.listTags(data.eventId)
                  : yield* events.listLevels(data.eventId);
        const position = list.length + 1;
        if (data.kind === "track") {
          const input = { name: data.name, color: data.color ?? "#1d6b4c", position };
          return data.id === null
            ? yield* events.createTrack({ ...input, eventId: data.eventId })
            : yield* events.updateTrack(data.id, input);
        }
        if (data.kind === "format") {
          const input = {
            name: data.name,
            durationMinutes: data.durationMinutes ?? 30,
            position,
          };
          return data.id === null
            ? yield* events.createFormat({ ...input, eventId: data.eventId })
            : yield* events.updateFormat(data.id, input);
        }
        if (data.kind === "room") {
          const input = { name: data.name, position, capacity: null };
          return data.id === null
            ? yield* events.createRoom({ ...input, eventId: data.eventId })
            : yield* events.updateRoom(data.id, input);
        }
        const input = { name: data.name, position };
        if (data.kind === "tag") {
          return data.id === null
            ? yield* events.createTag({ ...input, eventId: data.eventId })
            : yield* events.updateTag(data.id, input);
        }
        return data.id === null
          ? yield* events.createLevel({ ...input, eventId: data.eventId })
          : yield* events.updateLevel(data.id, input);
      }),
      { require: "admin" },
    ),
  );

export const deleteLibraryItem = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(LibraryDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const events = yield* Events;
        yield* requireEvent(data.eventId);
        if (data.kind === "track") return yield* events.deleteTrack(data.id);
        if (data.kind === "format") return yield* events.deleteFormat(data.id);
        if (data.kind === "room") return yield* events.deleteRoom(data.id);
        if (data.kind === "tag") return yield* events.deleteTag(data.id);
        return yield* events.deleteLevel(data.id);
      }),
      { require: "admin" },
    ),
  );
