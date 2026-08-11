import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { DbError, Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Events, ReadModels } from "@opensesh/domain/server/repos";
import {
  EventSettingsRequest,
  LibraryDeleteRequest,
  LibraryMutationRequest,
  NewEventRequest,
} from "@opensesh/domain/server/schema/core";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
  runServer(
    Effect.gen(function* () {
      const events = yield* Events;
      const user = yield* getCurrentUser;
      if (user.eventSlug === null) return [];
      return yield* events.listForAdmin(
        {
          userId: user.userId,
          email: user.email,
          activeOrganizationId: user.orgId,
        },
        user.eventSlug,
      );
    }),
    { require: "staff" },
  ),
);

export const searchAdminEvents = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String, query: Schema.String })),
  )
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const events = yield* Events;
        const available = yield* events.listForAdmin(session, eventSlug);
        if (!available.some((event) => event.id === data.eventId)) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot access this event" }));
        }
        const query = data.query.trim().toLocaleLowerCase();
        return available
          .filter((event) => event.name.toLocaleLowerCase().includes(query))
          .slice(0, 30);
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
        if (endsAt <= startsAt) {
          return yield* Effect.fail(new InvalidInput({ message: "Event end must be after start" }));
        }
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
            type: data.type,
            websiteUrl: null,
            location: null,
            timezone: data.timezone,
            startsAt,
            endsAt,
            theme: null,
            logoUrl: null,
            logoKey: null,
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
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    return runServer(
      Effect.gen(function* () {
        const events = yield* Events;
        const event = yield* requireEvent(data.eventId);
        const [startsAt, endsAt] = yield* Effect.all([
          dateOrFail(data.startsAt),
          dateOrFail(data.endsAt),
        ]);
        if (endsAt <= startsAt) {
          return yield* Effect.fail(new InvalidInput({ message: "Event end must be after start" }));
        }
        if (data.defaultSubmissionLimit < 1 || !Number.isInteger(data.defaultSubmissionLimit)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Submission limit must be a whole number of at least 1" }),
          );
        }
        let logoKey = data.logoUrl === event.logoUrl ? event.logoKey : null;
        let logoUrl = data.logoUrl;
        if (data.logoUpload !== null) {
          if (data.logoUpload.size > 2 * 1024 * 1024) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Event icons must be 2 MB or smaller" }),
            );
          }
          if (
            data.logoUpload.contentType !== "image/png" &&
            data.logoUpload.contentType !== "image/jpeg" &&
            data.logoUpload.contentType !== "image/svg+xml"
          ) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Use a PNG, JPG, or SVG event icon" }),
            );
          }
          const bytes = decodeBase64(data.logoUpload.base64);
          if (bytes.byteLength !== data.logoUpload.size) {
            return yield* Effect.fail(
              new InvalidInput({ message: "The uploaded event icon is incomplete" }),
            );
          }
          const storageKey = `events/${event.id}/icon/${crypto.randomUUID()}`;
          yield* Effect.tryPromise({
            try: () =>
              env.FILES.put(storageKey, bytes, {
                httpMetadata: {
                  contentType: data.logoUpload?.contentType ?? "application/octet-stream",
                  contentDisposition: "inline",
                },
              }),
            catch: (cause) => new DbError({ message: "Could not store the event icon", cause }),
          });
          logoKey = storageKey;
          logoUrl = `${new URL(request.url).origin}/event-assets/${event.id}/icon`;
        }
        return yield* events.update(data.eventId, {
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          startsAt,
          endsAt,
          timezone: data.timezone,
          location: data.location,
          type: data.type,
          websiteUrl: data.websiteUrl,
          defaultSubmissionLimit: data.defaultSubmissionLimit,
          logoUrl,
          logoKey,
        });
      }),
      { require: "admin" },
    );
  });

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
