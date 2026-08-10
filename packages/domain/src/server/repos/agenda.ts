import { and, asc, eq } from "drizzle-orm";
import { Clock, Context, Effect, Layer } from "effect";

import { validateScheduleChange } from "../../agenda/schedule";
import {
  contacts,
  events,
  formats,
  rooms,
  submissionParticipants,
  submissions,
  submissionTracks,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import type { DbError, InvalidInput, NotFound } from "../errors";
import { InvalidInput as InvalidInputError } from "../errors";
import {
  AgendaAdminData,
  type AgendaSession,
  PublicAgenda,
  PublishedAgendaSession,
  type ScheduleChange,
} from "../schema/agenda";
import { Event, Format, Room, Track } from "../schema/core";
import { Contact, Submission, SubmissionParticipant, SubmissionTrack } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface AgendaService {
  readonly admin: (eventId: string) => Effect.Effect<AgendaAdminData, DbError | NotFound>;
  readonly saveSchedule: (
    input: ScheduleChange,
  ) => Effect.Effect<AgendaAdminData, DbError | InvalidInput | NotFound>;
  readonly publish: (eventId: string) => Effect.Effect<AgendaAdminData, DbError | NotFound>;
  readonly unpublish: (eventId: string) => Effect.Effect<AgendaAdminData, DbError | NotFound>;
  readonly public: (eventSlug: string) => Effect.Effect<PublicAgenda | null, DbError | NotFound>;
}

export class Agenda extends Context.Service<Agenda, AgendaService>()("opensesh/Agenda") {}

export const AgendaLive = Layer.effect(
  Agenda,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const loadAdmin = (eventId: string) =>
      Effect.gen(function* () {
        const eventRows = yield* query(database, "Could not load agenda event", (db) =>
          db.select().from(events).where(eq(events.id, eventId)).limit(1).execute(),
        );
        const event = yield* decodeFound(Event, "Event", eventRows[0]);
        const [roomRows, formatRows, submissionRows, trackRows, participantRows] =
          yield* Effect.all(
            [
              query(database, "Could not list agenda rooms", (db) =>
                db
                  .select()
                  .from(rooms)
                  .where(eq(rooms.eventId, eventId))
                  .orderBy(asc(rooms.position))
                  .execute(),
              ),
              query(database, "Could not list agenda formats", (db) =>
                db.select().from(formats).where(eq(formats.eventId, eventId)).execute(),
              ),
              query(database, "Could not list accepted agenda sessions", (db) =>
                db
                  .select()
                  .from(submissions)
                  .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "accepted")))
                  .orderBy(asc(submissions.code))
                  .execute(),
              ),
              query(database, "Could not list agenda tracks", (db) =>
                db
                  .select({ link: submissionTracks, track: tracks })
                  .from(submissionTracks)
                  .innerJoin(submissions, eq(submissions.id, submissionTracks.submissionId))
                  .innerJoin(tracks, eq(tracks.id, submissionTracks.trackId))
                  .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "accepted")))
                  .orderBy(asc(tracks.position))
                  .execute(),
              ),
              query(database, "Could not list agenda speakers", (db) =>
                db
                  .select({ link: submissionParticipants, contact: contacts })
                  .from(submissionParticipants)
                  .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                  .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                  .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "accepted")))
                  .orderBy(asc(submissionParticipants.position))
                  .execute(),
              ),
            ],
            { concurrency: 5 },
          );

        const [decodedRooms, decodedFormats, decodedSubmissions] = yield* Effect.all(
          [
            decodeMany(Room, "room", roomRows),
            decodeMany(Format, "format", formatRows),
            decodeMany(Submission, "submission", submissionRows),
          ],
          { concurrency: 3 },
        );
        const decodedTracks = yield* Effect.forEach(
          trackRows,
          (row) =>
            Effect.all({
              link: decode(SubmissionTrack, "submission track", row.link),
              track: decode(Track, "track", row.track),
            }),
          { concurrency: 10 },
        );
        const decodedParticipants = yield* Effect.forEach(
          participantRows,
          (row) =>
            Effect.all({
              link: decode(SubmissionParticipant, "submission participant", row.link),
              contact: decode(Contact, "contact", row.contact),
            }),
          { concurrency: 10 },
        );

        const formatById = new Map(decodedFormats.map((format) => [format.id, format]));
        const sessions: ReadonlyArray<AgendaSession> = decodedSubmissions.map((submission) => {
          const format =
            submission.formatId === null ? undefined : formatById.get(submission.formatId);
          return {
            id: submission.id,
            code: submission.code,
            title: submission.title,
            description: submission.description,
            startsAt: submission.startsAt?.toISOString() ?? null,
            endsAt: submission.endsAt?.toISOString() ?? null,
            roomId: submission.roomId,
            scheduleDirty: submission.scheduleDirty,
            durationMinutes: format?.durationMinutes ?? 30,
            formatName: format?.name ?? null,
            tracks: decodedTracks
              .filter((row) => row.link.submissionId === submission.id)
              .map((row) => ({
                id: row.track.id,
                name: row.track.name,
                color: row.track.color,
              })),
            speakers: decodedParticipants
              .filter((row) => row.link.submissionId === submission.id)
              .map((row) => ({
                id: row.contact.id,
                name: `${row.contact.firstName} ${row.contact.lastName}`,
              })),
          };
        });

        return yield* decode(AgendaAdminData, "agenda", {
          event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
            timezone: event.timezone,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt.toISOString(),
            agendaPublishedAt: event.agendaPublishedAt?.toISOString() ?? null,
            agendaDirty: event.agendaDirty,
          },
          rooms: decodedRooms.map((room) => ({
            id: room.id,
            name: room.name,
            position: room.position,
          })),
          tracks: decodedTracks
            .map((row) => row.track)
            .filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index)
            .map((track) => ({ id: track.id, name: track.name, color: track.color })),
          sessions,
        });
      });

    const setPublication = (eventId: string, publish: boolean) =>
      Effect.gen(function* () {
        const agenda = yield* loadAdmin(eventId);
        const now = new Date(yield* Clock.currentTimeMillis);
        const roomById = new Map(agenda.rooms.map((room) => [room.id, room.name]));
        const snapshot = agenda.sessions
          .flatMap((session) => {
            if (session.startsAt === null || session.endsAt === null || session.roomId === null) {
              return [];
            }
            const roomName = roomById.get(session.roomId);
            return roomName === undefined
              ? []
              : [
                  {
                    id: session.id,
                    code: session.code,
                    title: session.title,
                    description: session.description,
                    startsAt: session.startsAt,
                    endsAt: session.endsAt,
                    roomName,
                    tracks: session.tracks,
                    speakers: session.speakers,
                  },
                ];
          })
          .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
        const decodedSnapshot = yield* decodeMany(
          PublishedAgendaSession,
          "published agenda session",
          snapshot,
        );
        yield* query(database, "Could not update agenda publication", (db) =>
          db
            .update(events)
            .set({
              agendaPublishedAt: publish ? now : null,
              publishedAgenda: publish ? decodedSnapshot : [],
              agendaDirty: !publish,
              updatedAt: now,
            })
            .where(eq(events.id, eventId))
            .execute(),
        );
        return yield* loadAdmin(eventId);
      });

    return {
      admin: loadAdmin,
      saveSchedule: (input) =>
        Effect.gen(function* () {
          const agenda = yield* loadAdmin(input.eventId);
          const session = agenda.sessions.find((item) => item.id === input.submissionId);
          if (session === undefined) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "Choose an accepted session" }),
            );
          }
          const validation = validateScheduleChange(input, {
            timezone: agenda.event.timezone,
            startsAt: agenda.event.startsAt,
            endsAt: agenda.event.endsAt,
            roomIds: agenda.rooms.map((room) => room.id),
          });
          if (validation !== null) {
            return yield* Effect.fail(new InvalidInputError({ message: validation }));
          }
          const now = new Date(yield* Clock.currentTimeMillis);
          yield* query(database, "Could not save agenda schedule", (db) =>
            db.transaction(async (transaction) => {
              await transaction
                .update(submissions)
                .set({
                  roomId: input.roomId,
                  startsAt: input.startsAt === null ? null : new Date(input.startsAt),
                  endsAt: input.endsAt === null ? null : new Date(input.endsAt),
                  scheduleDirty: true,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(submissions.id, input.submissionId),
                    eq(submissions.eventId, input.eventId),
                    eq(submissions.status, "accepted"),
                  ),
                )
                .execute();
              await transaction
                .update(events)
                .set({ agendaDirty: true, updatedAt: now })
                .where(eq(events.id, input.eventId))
                .execute();
            }),
          );
          return yield* loadAdmin(input.eventId);
        }),
      publish: (eventId) => setPublication(eventId, true),
      unpublish: (eventId) => setPublication(eventId, false),
      public: (eventSlug) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load public agenda", (db) =>
            db.select().from(events).where(eq(events.slug, eventSlug)).limit(1).execute(),
          );
          const event = yield* decodeFound(Event, "Event", rows[0]);
          if (event.agendaPublishedAt === null) return null;
          return yield* decode(PublicAgenda, "public agenda", {
            event: {
              name: event.name,
              slug: event.slug,
              timezone: event.timezone,
              publishedAt: event.agendaPublishedAt.toISOString(),
            },
            sessions: event.publishedAgenda,
          });
        }),
    };
  }),
);
