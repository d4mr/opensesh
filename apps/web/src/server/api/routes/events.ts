import { getCurrentUser, requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Events, Organization, ReadModels } from "@opensesh/domain/server/repos";
import {
  Event,
  EventAdmin,
  Format,
  Level,
  Room,
  Tag,
  Track,
} from "@opensesh/domain/server/schema/core";
import {
  OrganizationInvitationView,
  OrganizationMemberView,
  OrganizationProfile,
  OrganizationRole,
} from "@opensesh/domain/server/schema/organization";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const dateOrFail = (value: string, label: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? Effect.fail(new InvalidInput({ message: `${label} is not a valid ISO date` }))
    : Effect.succeed(date);
};

const CreateEventBody = Schema.Struct({
  name: Schema.String,
  type: Schema.Literals(["conference", "summit", "meetup"]),
  timezone: Schema.String,
  startsAt: Schema.String,
  endsAt: Schema.String,
});

const UpdateEventBody = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  tagline: Schema.optionalKey(Schema.NullOr(Schema.String)),
  description: Schema.optionalKey(Schema.NullOr(Schema.String)),
  type: Schema.optionalKey(Schema.Literals(["conference", "summit", "meetup"])),
  websiteUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  location: Schema.optionalKey(Schema.NullOr(Schema.String)),
  timezone: Schema.optionalKey(Schema.String),
  startsAt: Schema.optionalKey(Schema.String),
  endsAt: Schema.optionalKey(Schema.String),
  defaultSubmissionLimit: Schema.optionalKey(Schema.Number),
});

const LibraryItemBody = Schema.Struct({
  kind: Schema.Literals(["track", "format", "room", "tag", "level"]),
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  color: Schema.optionalKey(Schema.NullOr(Schema.String)),
  durationMinutes: Schema.optionalKey(Schema.NullOr(Schema.Number)),
});

export const eventEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/organization",
    operationId: "getOrganization",
    summary: "Get the organization",
    description:
      "The organization the API key belongs to, with its members and pending invitations.",
    tag: "Organization",
    successSchema: Schema.Struct({
      organization: OrganizationProfile,
      viewerRole: OrganizationRole,
      members: Schema.Array(OrganizationMemberView),
      pendingInvitations: Schema.Array(OrganizationInvitationView),
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const organization = yield* Organization;
        const viewer = yield* getCurrentUser;
        const organizationId = context.principal.organizationId;
        const [profile, members, invitations] = yield* Effect.all([
          organization.getProfile(organizationId, viewer.userId),
          organization.listMembers(organizationId),
          organization.listPendingInvitations(organizationId),
        ]);
        return { ...profile, members, pendingInvitations: invitations };
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events",
    operationId: "listEvents",
    summary: "List events",
    tag: "Events",
    successSchema: Schema.Array(Event),
    handler: (context) =>
      Effect.gen(function* () {
        const events = yield* Events;
        return yield* events.listByOrganization(context.principal.organizationId);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events",
    operationId: "createEvent",
    summary: "Create an event",
    tag: "Events",
    bodySchema: CreateEventBody,
    successStatus: 201,
    successSchema: Event,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof CreateEventBody.Type;
        const events = yield* Events;
        const [startsAt, endsAt, organizationEvents] = yield* Effect.all([
          dateOrFail(body.startsAt, "startsAt"),
          dateOrFail(body.endsAt, "endsAt"),
          events.listByOrganization(context.principal.organizationId),
        ]);
        if (endsAt <= startsAt) {
          return yield* Effect.fail(new InvalidInput({ message: "Event end must be after start" }));
        }
        const base = slugify(body.name) || "event";
        const slug = organizationEvents.some((event) => event.slug === base)
          ? `${base}-${organizationEvents.length + 1}`
          : base;
        return yield* events.create(
          {
            organizationId: context.principal.organizationId,
            name: body.name,
            slug,
            tagline: null,
            description: null,
            type: body.type,
            websiteUrl: null,
            location: null,
            timezone: body.timezone,
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
          // API keys act as the whole organization, not a person — access to
          // the new event flows from the org, so there is no member row.
          null,
        );
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}",
    operationId: "getEvent",
    summary: "Get an event",
    tag: "Events",
    successSchema: Event,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        return yield* events.get(access.event.id);
      }),
  }),
  endpoint({
    method: "PATCH",
    path: "/events/{eventId}",
    operationId: "updateEvent",
    summary: "Update an event",
    description: "Partial update — omitted fields keep their current value.",
    tag: "Events",
    bodySchema: UpdateEventBody,
    successSchema: Event,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof UpdateEventBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        const event = yield* events.get(access.event.id);
        const startsAt =
          body.startsAt === undefined
            ? event.startsAt
            : yield* dateOrFail(body.startsAt, "startsAt");
        const endsAt =
          body.endsAt === undefined ? event.endsAt : yield* dateOrFail(body.endsAt, "endsAt");
        if (endsAt <= startsAt) {
          return yield* Effect.fail(new InvalidInput({ message: "Event end must be after start" }));
        }
        const defaultSubmissionLimit = body.defaultSubmissionLimit ?? event.defaultSubmissionLimit;
        if (defaultSubmissionLimit < 1 || !Number.isInteger(defaultSubmissionLimit)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "defaultSubmissionLimit must be a whole number ≥ 1" }),
          );
        }
        return yield* events.update(access.event.id, {
          name: body.name ?? event.name,
          tagline: body.tagline === undefined ? event.tagline : body.tagline,
          description: body.description === undefined ? event.description : body.description,
          startsAt,
          endsAt,
          timezone: body.timezone ?? event.timezone,
          location: body.location === undefined ? event.location : body.location,
          type: body.type ?? event.type,
          websiteUrl: body.websiteUrl === undefined ? event.websiteUrl : body.websiteUrl,
          defaultSubmissionLimit,
          logoUrl: event.logoUrl,
          logoKey: event.logoKey,
        });
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/library",
    operationId: "getEventLibrary",
    summary: "Get the event library",
    description: "Tracks, formats, rooms, tags, and levels for the event.",
    tag: "Events",
    successSchema: Schema.Struct({
      tracks: Schema.Array(Track),
      formats: Schema.Array(Format),
      rooms: Schema.Array(Room),
      tags: Schema.Array(Tag),
      levels: Schema.Array(Level),
      admins: Schema.Array(EventAdmin),
    }),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reads = yield* ReadModels;
        return yield* reads.eventLibraryForAdmin(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/library",
    operationId: "saveLibraryItem",
    summary: "Create or update a library item",
    description: "Pass id: null to create; an existing id updates that item.",
    tag: "Events",
    bodySchema: LibraryItemBody,
    successSchema: Schema.Union([Track, Format, Room, Tag, Level]),
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof LibraryItemBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        const eventId = access.event.id;
        const list =
          body.kind === "track"
            ? yield* events.listTracks(eventId)
            : body.kind === "format"
              ? yield* events.listFormats(eventId)
              : body.kind === "room"
                ? yield* events.listRooms(eventId)
                : body.kind === "tag"
                  ? yield* events.listTags(eventId)
                  : yield* events.listLevels(eventId);
        const position = list.length + 1;
        if (body.kind === "track") {
          const input = { name: body.name, color: body.color ?? "#1d6b4c", position };
          return body.id === null
            ? yield* events.createTrack({ ...input, eventId })
            : yield* events.updateTrack(body.id, input);
        }
        if (body.kind === "format") {
          const input = { name: body.name, durationMinutes: body.durationMinutes ?? 30, position };
          return body.id === null
            ? yield* events.createFormat({ ...input, eventId })
            : yield* events.updateFormat(body.id, input);
        }
        if (body.kind === "room") {
          const input = { name: body.name, position, capacity: null };
          return body.id === null
            ? yield* events.createRoom({ ...input, eventId })
            : yield* events.updateRoom(body.id, input);
        }
        const input = { name: body.name, position };
        if (body.kind === "tag") {
          return body.id === null
            ? yield* events.createTag({ ...input, eventId })
            : yield* events.updateTag(body.id, input);
        }
        return body.id === null
          ? yield* events.createLevel({ ...input, eventId })
          : yield* events.updateLevel(body.id, input);
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/events/{eventId}/library/{kind}/{itemId}",
    operationId: "deleteLibraryItem",
    summary: "Delete a library item",
    tag: "Events",
    successStatus: 204,
    successSchema: Schema.Void,
    handler: (context) =>
      Effect.gen(function* () {
        yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const events = yield* Events;
        const kind = context.params.kind ?? "";
        const id = context.params.itemId ?? "";
        if (kind === "track") return yield* events.deleteTrack(id);
        if (kind === "format") return yield* events.deleteFormat(id);
        if (kind === "room") return yield* events.deleteRoom(id);
        if (kind === "tag") return yield* events.deleteTag(id);
        if (kind === "level") return yield* events.deleteLevel(id);
        return yield* Effect.fail(
          new InvalidInput({ message: "kind must be one of track, format, room, tag, level" }),
        );
      }),
  }),
];
