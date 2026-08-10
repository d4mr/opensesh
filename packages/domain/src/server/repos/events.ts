import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { events, formats, levels, rooms, tags, tracks } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  Event,
  type EventCreate,
  type EventUpdate,
  Format,
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
  readonly get: (id: string) => Effect.Effect<Event, DbError | NotFound>;
  readonly getBySlug: (slug: string) => Effect.Effect<Event, DbError | NotFound>;
  readonly create: (input: EventCreate) => Effect.Effect<Event, DbError>;
  readonly update: (id: string, input: EventUpdate) => Effect.Effect<Event, DbError | NotFound>;
  readonly listTracks: (eventId: string) => Effect.Effect<ReadonlyArray<Track>, DbError>;
  readonly createTrack: (input: TrackCreate) => Effect.Effect<Track, DbError>;
  readonly updateTrack: (
    id: string,
    input: TrackUpdate,
  ) => Effect.Effect<Track, DbError | NotFound>;
  readonly listTags: (eventId: string) => Effect.Effect<ReadonlyArray<Tag>, DbError>;
  readonly createTag: (input: LibraryItemCreate) => Effect.Effect<Tag, DbError>;
  readonly updateTag: (
    id: string,
    input: LibraryItemUpdate,
  ) => Effect.Effect<Tag, DbError | NotFound>;
  readonly listFormats: (eventId: string) => Effect.Effect<ReadonlyArray<Format>, DbError>;
  readonly createFormat: (input: LibraryItemCreate) => Effect.Effect<Format, DbError>;
  readonly updateFormat: (
    id: string,
    input: LibraryItemUpdate,
  ) => Effect.Effect<Format, DbError | NotFound>;
  readonly listLevels: (eventId: string) => Effect.Effect<ReadonlyArray<Level>, DbError>;
  readonly createLevel: (input: LibraryItemCreate) => Effect.Effect<Level, DbError>;
  readonly updateLevel: (
    id: string,
    input: LibraryItemUpdate,
  ) => Effect.Effect<Level, DbError | NotFound>;
  readonly listRooms: (eventId: string) => Effect.Effect<ReadonlyArray<Room>, DbError>;
  readonly createRoom: (input: RoomCreate) => Effect.Effect<Room, DbError>;
  readonly updateRoom: (id: string, input: RoomUpdate) => Effect.Effect<Room, DbError | NotFound>;
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

    return {
      list: () =>
        query(database, "Could not list events", (db) =>
          db.select().from(events).orderBy(asc(events.startsAt)).execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Event, "event", rows))),
      get: (id) => find(events.id, id),
      getBySlug: (slug) => find(events.slug, slug),
      create: (input) =>
        query(database, "Could not create event", (db) =>
          db.insert(events).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Event, "event", rows[0]))),
      update: (id, input) =>
        query(database, "Could not update event", (db) =>
          db
            .update(events)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(events.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Event, "Event", rows[0]))),
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
    };
  }),
);
