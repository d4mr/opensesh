import { and, asc, count, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer } from "effect";

import {
  eventMembers,
  events,
  formats,
  levels,
  organizationMembers,
  reviewAssignments,
  reviewRoundMembers,
  reviewerTracks,
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
import { Forbidden, InvalidInput, NotFound, ResourceInUse, type DbError } from "../errors";
import {
  Event,
  type EventCreate,
  EventAccess,
  type EventAccessEntry,
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
  ReviewerTrackSet,
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
  // creatorUserId gets an event_members admin row in the same transaction —
  // "you create an event, you are its admin" must hold even when the creator
  // is only an event-scoped admin elsewhere (org owners/admins keep derived
  // access regardless; their row is idempotent insurance against demotion).
  readonly create: (
    input: EventCreate,
    creatorUserId: string | null,
  ) => Effect.Effect<Event, DbError>;
  readonly update: (id: string, input: EventUpdate) => Effect.Effect<Event, DbError | NotFound>;
  readonly listAdmins: (eventId: string) => Effect.Effect<ReadonlyArray<EventAdmin>, DbError>;
  readonly listAccess: (eventId: string) => Effect.Effect<EventAccess, DbError>;
  readonly grantAdmin: (
    eventId: string,
    userId: string,
  ) => Effect.Effect<void, DbError | InvalidInput>;
  readonly revokeAdmin: (
    eventId: string,
    userId: string,
  ) => Effect.Effect<"removed" | "reviewer", DbError | NotFound>;
  readonly listTracks: (eventId: string) => Effect.Effect<ReadonlyArray<Track>, DbError>;
  readonly listReviewerTracks: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<ReviewerTrackSet>, DbError>;
  readonly setReviewerTracks: (
    eventId: string,
    eventMemberId: string,
    trackIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReviewerTrackSet, DbError | InvalidInput | NotFound>;
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
            .select({
              event: organizationEvent,
            })
            .from(currentEvent)
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, currentEvent.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              organizationEvent,
              eq(organizationEvent.organizationId, currentEvent.organizationId),
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
              Effect.map((decoded) => [
                ...decoded.filter((event) => event.slug === eventSlug),
                ...decoded.filter((event) => event.slug !== eventSlug),
              ]),
            ),
          ),
        ),
      get: (id) => find(events.id, id),
      getBySlug: (slug) => find(events.slug, slug),
      create: (input, creatorUserId) =>
        query(database, "Could not create event", (db) =>
          db.transaction(async (transaction) => {
            const rows = await transaction.insert(events).values(input).returning().execute();
            const event = rows[0];
            if (event !== undefined && creatorUserId !== null) {
              await transaction
                .insert(eventMembers)
                .values({ eventId: event.id, userId: creatorUserId, role: "admin" })
                .onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] })
                .execute();
            }
            return rows;
          }),
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
      // Event admins are derived: every org owner/admin plus the
      // explicitly-invited event-scoped admins, deduped by user.
      listAdmins: (eventId) =>
        Effect.all([
          query(database, "Could not list organization admins", (db) =>
            db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(events)
              .innerJoin(
                organizationMembers,
                and(
                  eq(organizationMembers.organizationId, events.organizationId),
                  inArray(organizationMembers.role, ["owner", "admin"]),
                ),
              )
              .innerJoin(users, eq(users.id, organizationMembers.userId))
              .where(eq(events.id, eventId))
              .execute(),
          ),
          query(database, "Could not list event admins", (db) =>
            db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(eventMembers)
              .innerJoin(users, eq(users.id, eventMembers.userId))
              .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.role, "admin")))
              .execute(),
          ),
        ]).pipe(
          Effect.flatMap(([organizationAdmins, overlayAdmins]) =>
            decodeMany(
              EventAdmin,
              "event admin",
              Array.from(
                new Map(
                  [...organizationAdmins, ...overlayAdmins].map((admin) => [admin.id, admin]),
                ).values(),
              ).sort((left, right) => left.name.localeCompare(right.name)),
            ),
          ),
        ),
      // The full access picture for one event: org owners/admins (derived,
      // managed in organization settings) plus the event-scoped overlay rows.
      // Overlay rows always belong to org members, so one join covers both.
      listAccess: (eventId) =>
        query(database, "Could not load event access", (db) =>
          db
            .select({
              userId: users.id,
              name: users.name,
              email: users.email,
              orgRole: organizationMembers.role,
              overlayRole: eventMembers.role,
            })
            .from(events)
            .innerJoin(
              organizationMembers,
              eq(organizationMembers.organizationId, events.organizationId),
            )
            .innerJoin(users, eq(users.id, organizationMembers.userId))
            .leftJoin(
              eventMembers,
              and(eq(eventMembers.eventId, events.id), eq(eventMembers.userId, users.id)),
            )
            .where(eq(events.id, eventId))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => {
            const entryFor = (row: (typeof rows)[number]): EventAccessEntry | null => {
              const base = { userId: row.userId, name: row.name, email: row.email };
              if (row.orgRole === "owner" || row.orgRole === "admin") {
                return { ...base, source: "organization", role: row.orgRole };
              }
              if (row.overlayRole !== null) {
                return { ...base, source: "event", role: row.overlayRole };
              }
              return null;
            };
            const rank = (entry: EventAccessEntry) =>
              entry.source === "organization"
                ? entry.role === "owner"
                  ? 0
                  : 1
                : entry.role === "admin"
                  ? 2
                  : 3;
            const entries = rows
              .flatMap((row) => entryFor(row) ?? [])
              .sort(
                (left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name),
              );
            const grantable = rows
              .filter(
                (row) =>
                  row.orgRole !== "owner" && row.orgRole !== "admin" && row.overlayRole !== "admin",
              )
              .map((row) => ({ userId: row.userId, name: row.name, email: row.email }))
              .sort((left, right) => left.name.localeCompare(right.name));
            return decode(EventAccess, "event access", { entries, grantable });
          }),
        ),
      grantAdmin: (eventId, userId) =>
        Effect.gen(function* () {
          const membership = yield* query(
            database,
            "Could not check organization membership",
            (db) =>
              db
                .select({ id: organizationMembers.id })
                .from(events)
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, events.organizationId),
                    eq(organizationMembers.userId, userId),
                  ),
                )
                .where(eq(events.id, eventId))
                .execute(),
          );
          if (membership.length === 0) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Event admins must be organization members first" }),
            );
          }
          yield* query(database, "Could not grant event admin", (db) =>
            db
              .insert(eventMembers)
              .values({ eventId, userId, role: "admin" })
              .onConflictDoUpdate({
                target: [eventMembers.eventId, eventMembers.userId],
                set: { role: "admin", updatedAt: new Date() },
              })
              .execute(),
          );
        }),
      // Revoking admin never orphans review staffing: rows referenced by
      // reviewer assignments demote back to reviewer instead of deleting.
      revokeAdmin: (eventId, userId) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load event membership", (db) =>
            db
              .select()
              .from(eventMembers)
              .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
              .limit(1)
              .execute(),
          );
          const member = rows[0];
          if (member === undefined || member.role !== "admin") {
            return yield* Effect.fail(
              new NotFound({ message: "This person is not an event-scoped admin" }),
            );
          }
          const counts = yield* Effect.all([
            query(database, "Could not check reviewer tracks", (db) =>
              db
                .select({ value: count() })
                .from(reviewerTracks)
                .where(eq(reviewerTracks.eventMemberId, member.id))
                .execute(),
            ),
            query(database, "Could not check review rounds", (db) =>
              db
                .select({ value: count() })
                .from(reviewRoundMembers)
                .where(eq(reviewRoundMembers.eventMemberId, member.id))
                .execute(),
            ),
            query(database, "Could not check review assignments", (db) =>
              db
                .select({ value: count() })
                .from(reviewAssignments)
                .where(eq(reviewAssignments.eventMemberId, member.id))
                .execute(),
            ),
          ]);
          const staffed = counts.some((rows_) => (rows_[0]?.value ?? 0) > 0);
          if (staffed) {
            yield* query(database, "Could not demote event admin", (db) =>
              db
                .update(eventMembers)
                .set({ role: "reviewer", updatedAt: new Date() })
                .where(eq(eventMembers.id, member.id))
                .execute(),
            );
            return "reviewer" as const;
          }
          yield* query(database, "Could not remove event admin", (db) =>
            db.delete(eventMembers).where(eq(eventMembers.id, member.id)).execute(),
          );
          return "removed" as const;
        }),
      listTracks: (eventId) =>
        query(database, "Could not list tracks", (db) =>
          db
            .select()
            .from(tracks)
            .where(eq(tracks.eventId, eventId))
            .orderBy(asc(tracks.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Track, "track", rows))),
      listReviewerTracks: (eventId) =>
        query(database, "Could not list reviewer tracks", (db) =>
          db
            .select({ eventMemberId: eventMembers.id, trackId: reviewerTracks.trackId })
            .from(eventMembers)
            .leftJoin(reviewerTracks, eq(reviewerTracks.eventMemberId, eventMembers.id))
            .where(eq(eventMembers.eventId, eventId))
            .orderBy(asc(eventMembers.id), asc(reviewerTracks.trackId))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeMany(
              ReviewerTrackSet,
              "reviewer track set",
              Array.from(new Set(rows.map((row) => row.eventMemberId))).map((eventMemberId) => ({
                eventMemberId,
                trackIds: rows.flatMap((row) =>
                  row.eventMemberId === eventMemberId && row.trackId !== null ? [row.trackId] : [],
                ),
              })),
            ),
          ),
        ),
      setReviewerTracks: (eventId, eventMemberId, trackIds) => {
        const normalizedTrackIds = Array.from(new Set(trackIds)).sort();
        return query(database, "Could not set reviewer tracks", (db) =>
          db.transaction(async (transaction) => {
            const [member] = await transaction
              .select({ id: eventMembers.id })
              .from(eventMembers)
              .where(and(eq(eventMembers.id, eventMemberId), eq(eventMembers.eventId, eventId)))
              .limit(1)
              .execute();
            if (member === undefined) return { kind: "notFound" as const };
            const matchingTracks =
              normalizedTrackIds.length === 0
                ? []
                : await transaction
                    .select({ id: tracks.id })
                    .from(tracks)
                    .where(and(eq(tracks.eventId, eventId), inArray(tracks.id, normalizedTrackIds)))
                    .execute();
            if (matchingTracks.length !== normalizedTrackIds.length) {
              return { kind: "invalid" as const };
            }
            await transaction
              .delete(reviewerTracks)
              .where(eq(reviewerTracks.eventMemberId, eventMemberId))
              .execute();
            if (normalizedTrackIds.length > 0) {
              await transaction
                .insert(reviewerTracks)
                .values(normalizedTrackIds.map((trackId) => ({ eventMemberId, trackId })))
                .onConflictDoNothing()
                .execute();
            }
            return { kind: "ok" as const };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<ReviewerTrackSet, DbError | InvalidInput | NotFound> => {
              if (outcome.kind === "notFound") {
                return Effect.fail(new NotFound({ message: "Event member not found" }));
              }
              if (outcome.kind === "invalid") {
                return Effect.fail(
                  new InvalidInput({ message: "Every reviewer track must belong to this event" }),
                );
              }
              return decode(ReviewerTrackSet, "reviewer track set", {
                eventMemberId,
                trackIds: normalizedTrackIds,
              });
            },
          ),
        );
      },
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
