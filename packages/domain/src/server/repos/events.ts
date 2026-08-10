import { and, asc, count, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer } from "effect";

import {
  eventMembers,
  events,
  formats,
  levels,
  organizationMembers,
  rooms,
  submissionTags,
  submissionTracks,
  submissions,
  tags,
  tracks,
  users,
} from "../../db/schema";
import { Db } from "../db";
import type { SessionIdentity } from "../current-user";
import { Forbidden, ResourceInUse, type DbError, type NotFound } from "../errors";
import {
  Event,
  type EventCreate,
  EventAdmin,
  type EventUpdate,
  Format,
  type FormatCreate,
  type FormatUpdate,
  Level,
  type LibraryItemCreate,
  type LibraryItemUpdate,
  Room,
  type RoomCreate,
  type RoomUpdate,
  Tag,
  Track,
  type TrackCreate,
  type TrackUpdate,
} from "../schema/core";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface EventsService {
  readonly list: () => Effect.Effect<ReadonlyArray<Event>, DbError>;
  readonly listByOrganization: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<Event>, DbError>;
  readonly listForAdmin: (
    session: SessionIdentity,
    eventSlug: string,
  ) => Effect.Effect<ReadonlyArray<Event>, DbError | Forbidden>;
  readonly get: (id: string) => Effect.Effect<Event, DbError | NotFound>;
  readonly getBySlug: (slug: string) => Effect.Effect<Event, DbError | NotFound>;
  readonly create: (input: EventCreate) => Effect.Effect<Event, DbError>;
  readonly createForAdmin: (input: EventCreate, userId: string) => Effect.Effect<Event, DbError>;
  readonly update: (id: string, input: EventUpdate) => Effect.Effect<Event, DbError | NotFound>;
  readonly listAdmins: (eventId: string) => Effect.Effect<ReadonlyArray<EventAdmin>, DbError>;
  readonly listTracks: (eventId: string) => Effect.Effect<ReadonlyArray<Track>, DbError>;
  readonly createTrack: (input: TrackCreate) => Effect.Effect<Track, DbError>;
  readonly updateTrack: (
    id: string,
    input: TrackUpdate,
  ) => Effect.Effect<Track, DbError | NotFound>;
  readonly deleteTrack: (id: string) => Effect.Effect<void, DbError | ResourceInUse>;
  readonly listTags: (eventId: string) => Effect.Effect<ReadonlyArray<Tag>, DbError>;
  readonly createTag: (input: LibraryItemCreate) => Effect.Effect<Tag, DbError>;
  readonly updateTag: (
    id: string,
    input: LibraryItemUpdate,
  ) => Effect.Effect<Tag, DbError | NotFound>;
  readonly deleteTag: (id: string) => Effect.Effect<void, DbError | ResourceInUse>;
  readonly listFormats: (eventId: string) => Effect.Effect<ReadonlyArray<Format>, DbError>;
  readonly createFormat: (input: FormatCreate) => Effect.Effect<Format, DbError>;
  readonly updateFormat: (
    id: string,
    input: FormatUpdate,
  ) => Effect.Effect<Format, DbError | NotFound>;
  readonly deleteFormat: (id: string) => Effect.Effect<void, DbError | ResourceInUse>;
  readonly listLevels: (eventId: string) => Effect.Effect<ReadonlyArray<Level>, DbError>;
  readonly createLevel: (input: LibraryItemCreate) => Effect.Effect<Level, DbError>;
  readonly updateLevel: (
    id: string,
    input: LibraryItemUpdate,
  ) => Effect.Effect<Level, DbError | NotFound>;
  readonly deleteLevel: (id: string) => Effect.Effect<void, DbError | ResourceInUse>;
  readonly listRooms: (eventId: string) => Effect.Effect<ReadonlyArray<Room>, DbError>;
  readonly createRoom: (input: RoomCreate) => Effect.Effect<Room, DbError>;
  readonly updateRoom: (id: string, input: RoomUpdate) => Effect.Effect<Room, DbError | NotFound>;
  readonly deleteRoom: (id: string) => Effect.Effect<void, DbError | ResourceInUse>;
}

export class Events extends Context.Service<Events, EventsService>()("opensesh/Events") {}

export const EventsLive = Layer.effect(
  Events,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const find = (column: typeof events.id | typeof events.slug, value: string) =>
      query(database, "Could not load event", (db) =>
        db.select().from(events).where(eq(column, value)).limit(1).execute(),
      ).pipe(Effect.flatMap((rows) => decodeFound(Event, "Event", rows[0])));

    const currentEvent = alias(events, "current_event");
    const organizationEvent = alias(events, "organization_event");
    const organizationEventMember = alias(eventMembers, "organization_event_member");

    return {
      list: () =>
        query(database, "Could not list events", (db) =>
          db.select().from(events).orderBy(asc(events.startsAt)).execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Event, "event", rows))),
      listByOrganization: (organizationId) =>
        query(database, "Could not list organization events", (db) =>
          db
            .select()
            .from(events)
            .where(eq(events.organizationId, organizationId))
            .orderBy(asc(events.startsAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Event, "event", rows))),
      listForAdmin: (session, eventSlug) =>
        query(database, "Could not load admin events", (db) =>
          db
            .select({ event: organizationEvent, role: eventMembers.role })
            .from(currentEvent)
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, currentEvent.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              eventMembers,
              and(
                eq(eventMembers.eventId, currentEvent.id),
                eq(eventMembers.userId, session.userId),
                inArray(eventMembers.role, ["admin", "reviewer"]),
              ),
            )
            .innerJoin(
              organizationEvent,
              eq(organizationEvent.organizationId, currentEvent.organizationId),
            )
            // Only events the user actually belongs to — listing every org
            // event desyncs the switcher from membership-scoped reads.
            .innerJoin(
              organizationEventMember,
              and(
                eq(organizationEventMember.eventId, organizationEvent.id),
                eq(organizationEventMember.userId, session.userId),
                inArray(organizationEventMember.role, ["admin", "reviewer"]),
              ),
            )
            .where(
              and(
                eq(currentEvent.slug, eventSlug),
                session.activeOrganizationId === undefined
                  ? undefined
                  : eq(currentEvent.organizationId, session.activeOrganizationId),
              ),
            )
            .orderBy(asc(organizationEvent.startsAt))
            .execute(),
        ).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
          Effect.flatMap((rows) =>
            decodeMany(
              Event,
              "event",
              rows.map((row) => row.event),
            ).pipe(
              Effect.map((decoded) =>
                rows[0]?.role === "reviewer"
                  ? decoded.filter((event) => event.slug === eventSlug)
                  : [
                      ...decoded.filter((event) => event.slug === eventSlug),
                      ...decoded.filter((event) => event.slug !== eventSlug),
                    ],
              ),
            ),
          ),
        ),
      get: (id) => find(events.id, id),
      getBySlug: (slug) => find(events.slug, slug),
      create: (input) =>
        query(database, "Could not create event", (db) =>
          db.insert(events).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Event, "event", rows[0]))),
      createForAdmin: (input, userId) =>
        query(database, "Could not create event", (db) =>
          db.transaction(async (transaction) => {
            const rows = await transaction.insert(events).values(input).returning().execute();
            const event = rows[0];
            if (event !== undefined) {
              await transaction
                .insert(eventMembers)
                .values({ eventId: event.id, userId, role: "admin" })
                .execute();
            }
            return event;
          }),
        ).pipe(Effect.flatMap((row) => decode(Event, "event", row))),
      update: (id, input) =>
        query(database, "Could not update event", (db) =>
          db
            .update(events)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(events.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Event, "Event", rows[0]))),
      listAdmins: (eventId) =>
        query(database, "Could not list event admins", (db) =>
          db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(eventMembers)
            .innerJoin(users, eq(users.id, eventMembers.userId))
            .where(eq(eventMembers.eventId, eventId))
            .orderBy(asc(users.name))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(EventAdmin, "event admin", rows))),
      listTracks: (eventId) =>
        query(database, "Could not list tracks", (db) =>
          db
            .select()
            .from(tracks)
            .where(eq(tracks.eventId, eventId))
            .orderBy(asc(tracks.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Track, "track", rows))),
      createTrack: (input) =>
        query(database, "Could not create track", (db) =>
          db.insert(tracks).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Track, "track", rows[0]))),
      updateTrack: (id, input) =>
        query(database, "Could not update track", (db) =>
          db
            .update(tracks)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(tracks.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Track, "Track", rows[0]))),
      deleteTrack: (id) =>
        Effect.gen(function* () {
          const usage = yield* query(database, "Could not check track usage", (db) =>
            db
              .select({ value: count() })
              .from(submissionTracks)
              .where(eq(submissionTracks.trackId, id))
              .execute(),
          );
          if ((usage[0]?.value ?? 0) > 0) {
            return yield* Effect.fail(
              new ResourceInUse({ message: "Track cannot be deleted because it is in use" }),
            );
          }
          yield* query(database, "Could not delete track", (db) =>
            db.delete(tracks).where(eq(tracks.id, id)).execute(),
          );
        }),
      listTags: (eventId) =>
        query(database, "Could not list tags", (db) =>
          db
            .select()
            .from(tags)
            .where(eq(tags.eventId, eventId))
            .orderBy(asc(tags.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Tag, "tag", rows))),
      createTag: (input) =>
        query(database, "Could not create tag", (db) =>
          db.insert(tags).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Tag, "tag", rows[0]))),
      updateTag: (id, input) =>
        query(database, "Could not update tag", (db) =>
          db
            .update(tags)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(tags.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Tag, "Tag", rows[0]))),
      deleteTag: (id) =>
        Effect.gen(function* () {
          const usage = yield* query(database, "Could not check tag usage", (db) =>
            db
              .select({ value: count() })
              .from(submissionTags)
              .where(eq(submissionTags.tagId, id))
              .execute(),
          );
          if ((usage[0]?.value ?? 0) > 0) {
            return yield* Effect.fail(
              new ResourceInUse({ message: "Tag cannot be deleted because it is in use" }),
            );
          }
          yield* query(database, "Could not delete tag", (db) =>
            db.delete(tags).where(eq(tags.id, id)).execute(),
          );
        }),
      listFormats: (eventId) =>
        query(database, "Could not list formats", (db) =>
          db
            .select()
            .from(formats)
            .where(eq(formats.eventId, eventId))
            .orderBy(asc(formats.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Format, "format", rows))),
      createFormat: (input) =>
        query(database, "Could not create format", (db) =>
          db.insert(formats).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Format, "format", rows[0]))),
      updateFormat: (id, input) =>
        query(database, "Could not update format", (db) =>
          db
            .update(formats)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(formats.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Format, "Format", rows[0]))),
      deleteFormat: (id) =>
        Effect.gen(function* () {
          const usage = yield* query(database, "Could not check format usage", (db) =>
            db
              .select({ value: count() })
              .from(submissions)
              .where(eq(submissions.formatId, id))
              .execute(),
          );
          if ((usage[0]?.value ?? 0) > 0) {
            return yield* Effect.fail(
              new ResourceInUse({ message: "Format cannot be deleted because it is in use" }),
            );
          }
          yield* query(database, "Could not delete format", (db) =>
            db.delete(formats).where(eq(formats.id, id)).execute(),
          );
        }),
      listLevels: (eventId) =>
        query(database, "Could not list levels", (db) =>
          db
            .select()
            .from(levels)
            .where(eq(levels.eventId, eventId))
            .orderBy(asc(levels.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Level, "level", rows))),
      createLevel: (input) =>
        query(database, "Could not create level", (db) =>
          db.insert(levels).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Level, "level", rows[0]))),
      updateLevel: (id, input) =>
        query(database, "Could not update level", (db) =>
          db
            .update(levels)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(levels.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Level, "Level", rows[0]))),
      deleteLevel: (id) =>
        Effect.gen(function* () {
          const usage = yield* query(database, "Could not check level usage", (db) =>
            db
              .select({ value: count() })
              .from(submissions)
              .where(eq(submissions.levelId, id))
              .execute(),
          );
          if ((usage[0]?.value ?? 0) > 0) {
            return yield* Effect.fail(
              new ResourceInUse({ message: "Level cannot be deleted because it is in use" }),
            );
          }
          yield* query(database, "Could not delete level", (db) =>
            db.delete(levels).where(eq(levels.id, id)).execute(),
          );
        }),
      listRooms: (eventId) =>
        query(database, "Could not list rooms", (db) =>
          db
            .select()
            .from(rooms)
            .where(eq(rooms.eventId, eventId))
            .orderBy(asc(rooms.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Room, "room", rows))),
      createRoom: (input) =>
        query(database, "Could not create room", (db) =>
          db.insert(rooms).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Room, "room", rows[0]))),
      updateRoom: (id, input) =>
        query(database, "Could not update room", (db) =>
          db
            .update(rooms)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(rooms.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Room, "Room", rows[0]))),
      deleteRoom: (id) =>
        Effect.gen(function* () {
          const usage = yield* query(database, "Could not check room usage", (db) =>
            db
              .select({ value: count() })
              .from(submissions)
              .where(eq(submissions.roomId, id))
              .execute(),
          );
          if ((usage[0]?.value ?? 0) > 0) {
            return yield* Effect.fail(
              new ResourceInUse({ message: "Room cannot be deleted because it is in use" }),
            );
          }
          yield* query(database, "Could not delete room", (db) =>
            db.delete(rooms).where(eq(rooms.id, id)).execute(),
          );
        }),
    };
  }),
);
