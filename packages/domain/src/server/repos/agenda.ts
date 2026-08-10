import { and, asc, desc, eq } from "drizzle-orm";
import { Clock, Config, Context, Effect, Layer, Option, Schema } from "effect";

import { detectAgendaConflicts } from "../../agenda/conflicts";
import { validateScheduleChange } from "../../agenda/schedule";
import { solveAgendaDeterministically, validateAndRepairAgendaProposal } from "../../agenda/solver";
import {
  agendaDrafts,
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
import type {
  AgendaGenerationError,
  DbError,
  InvalidInput,
  NotFound,
  ScheduleConflict,
} from "../errors";
import {
  AgendaGenerationError as AgendaGenerationErrorFailure,
  InvalidInput as InvalidInputError,
  ScheduleConflict as ScheduleConflictError,
} from "../errors";
import {
  AcceptAgendaDraftResult,
  AgendaDraft,
  type AgendaDraftActionRequest,
  type AgendaDraft as AgendaDraftData,
  AgendaDraftProposal,
  type AgendaDraftProposal as AgendaDraftProposalData,
  AgendaDraftStored,
  AgendaAdminData,
  type AgendaSession,
  type GenerateAgendaDraftRequest,
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
  readonly listDrafts: (eventId: string) => Effect.Effect<ReadonlyArray<AgendaDraftData>, DbError>;
  readonly generateDraft: (
    input: GenerateAgendaDraftRequest,
  ) => Effect.Effect<AgendaDraftData, AgendaGenerationError | DbError | InvalidInput | NotFound>;
  readonly changeDraft: (
    input: AgendaDraftActionRequest,
  ) => Effect.Effect<AgendaDraftData, DbError | InvalidInput | NotFound>;
  readonly acceptDraft: (input: {
    readonly eventId: string;
    readonly draftId: string;
    readonly submissionIds: ReadonlyArray<string>;
  }) => Effect.Effect<
    typeof AcceptAgendaDraftResult.Type,
    DbError | InvalidInput | NotFound | ScheduleConflict
  >;
}

export class Agenda extends Context.Service<Agenda, AgendaService>()("opensesh/Agenda") {}

const MODEL = "claude-sonnet-5";
const AnthropicResponse = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      name: Schema.optionalKey(Schema.String),
      input: Schema.optionalKey(Schema.Unknown),
    }),
  ),
});

const requestAnthropicProposal = (
  apiKey: string,
  input: GenerateAgendaDraftRequest,
  agenda: AgendaAdminData,
) =>
  Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 8_192,
            temperature: 0.1,
            system:
              "You schedule conference sessions. Return every session exactly once. Use only the supplied room ids and event days, preserve exact durations, use 15-minute starts between 08:00 and 19:00 local time, and never overlap a room or speaker. Reasons must be one concise line. Respect all criteria rules when possible.",
            messages: [
              {
                role: "user",
                content: JSON.stringify({
                  timezone: agenda.event.timezone,
                  days: input.criteria.days,
                  rules: input.criteria.rules,
                  respectExistingPlacements: input.criteria.respectExistingPlacements,
                  rooms: agenda.rooms
                    .filter((room) => input.criteria.roomIds.includes(room.id))
                    .map((room) => ({ id: room.id, name: room.name })),
                  sessions: agenda.sessions.map((session) => ({
                    id: session.id,
                    title: session.title,
                    format: session.formatName,
                    tracks: session.tracks.map((track) => track.name),
                    speakers: session.speakers.map((speaker) => ({
                      id: speaker.id,
                      name: speaker.name,
                    })),
                    durationMinutes:
                      session.startsAt === null || session.endsAt === null
                        ? session.durationMinutes
                        : Math.round(
                            (Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000,
                          ),
                    currentPlacement:
                      session.roomId === null ||
                      session.startsAt === null ||
                      session.endsAt === null
                        ? null
                        : {
                            roomId: session.roomId,
                            startsAt: session.startsAt,
                            endsAt: session.endsAt,
                          },
                  })),
                }),
              },
            ],
            tools: [
              {
                name: "propose_agenda",
                description: "Return the complete proposed conference agenda.",
                input_schema: Schema.toJsonSchemaDocument(AgendaDraftProposal).schema,
              },
            ],
            tool_choice: { type: "tool", name: "propose_agenda" },
          }),
        }),
      catch: (cause) =>
        new AgendaGenerationErrorFailure({
          message: "Claude could not generate this draft",
          cause,
        }),
    });
    const responseText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) =>
        new AgendaGenerationErrorFailure({
          message: "Claude returned an unreadable response",
          cause,
        }),
    });
    const latency = (yield* Clock.currentTimeMillis) - startedAt;
    console.info(`[agenda-draft] model=${MODEL} latencyMs=${latency}`);
    if (!response.ok) {
      return yield* Effect.fail(
        new AgendaGenerationErrorFailure({
          message: `Claude could not generate this draft (${response.status})`,
          cause: responseText,
        }),
      );
    }
    const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(AnthropicResponse))(
      responseText,
    ).pipe(
      Effect.mapError(
        (cause) =>
          new AgendaGenerationErrorFailure({
            message: "Claude returned an invalid agenda response",
            cause,
          }),
      ),
    );
    const toolUse = decoded.content.find(
      (content) => content.type === "tool_use" && content.name === "propose_agenda",
    );
    if (toolUse?.input === undefined) {
      return yield* Effect.fail(
        new AgendaGenerationErrorFailure({
          message: "Claude did not return an agenda proposal",
          cause: decoded,
        }),
      );
    }
    return yield* Schema.decodeUnknownEffect(AgendaDraftProposal)(toolUse.input).pipe(
      Effect.mapError(
        (cause) =>
          new AgendaGenerationErrorFailure({
            message: "Claude returned an invalid agenda proposal",
            cause,
          }),
      ),
    );
  });

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

    const toAgendaDraft = (stored: typeof AgendaDraftStored.Type) =>
      decode(AgendaDraft, "agenda draft", {
        id: stored.id,
        eventId: stored.eventId,
        name: stored.name,
        status: stored.status,
        criteria: stored.criteria,
        proposal: stored.proposal,
        generatedAt: stored.generatedAt?.toISOString() ?? null,
        committedAt: stored.committedAt?.toISOString() ?? null,
        createdAt: stored.createdAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
      });

    const loadStoredDraft = (eventId: string, draftId: string) =>
      Effect.gen(function* () {
        const rows = yield* query(database, "Could not load agenda draft", (db) =>
          db
            .select()
            .from(agendaDrafts)
            .where(and(eq(agendaDrafts.id, draftId), eq(agendaDrafts.eventId, eventId)))
            .limit(1)
            .execute(),
        );
        return yield* decodeFound(AgendaDraftStored, "Agenda draft", rows[0]);
      });

    const persistScheduleChanges = (
      eventId: string,
      changes: ReadonlyArray<ScheduleChange>,
      now: Date,
      committedDraftId?: string,
    ) =>
      query(database, "Could not save agenda schedule", (db) =>
        db.transaction(async (transaction) => {
          for (const change of changes) {
            await transaction
              .update(submissions)
              .set({
                roomId: change.roomId,
                startsAt: change.startsAt === null ? null : new Date(change.startsAt),
                endsAt: change.endsAt === null ? null : new Date(change.endsAt),
                scheduleDirty: true,
                updatedAt: now,
              })
              .where(
                and(
                  eq(submissions.id, change.submissionId),
                  eq(submissions.eventId, eventId),
                  eq(submissions.status, "accepted"),
                ),
              )
              .execute();
          }
          await transaction
            .update(events)
            .set({ agendaDirty: true, updatedAt: now })
            .where(eq(events.id, eventId))
            .execute();
          if (committedDraftId !== undefined) {
            await transaction
              .update(agendaDrafts)
              .set({ status: "committed", committedAt: now, updatedAt: now })
              .where(
                and(
                  eq(agendaDrafts.id, committedDraftId),
                  eq(agendaDrafts.eventId, eventId),
                  eq(agendaDrafts.status, "generated"),
                ),
              )
              .execute();
          }
        }),
      );

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
          yield* persistScheduleChanges(input.eventId, [input], now);
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
      listDrafts: (eventId) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not list agenda drafts", (db) =>
            db
              .select()
              .from(agendaDrafts)
              .where(eq(agendaDrafts.eventId, eventId))
              .orderBy(desc(agendaDrafts.createdAt))
              .execute(),
          );
          const stored = yield* decodeMany(AgendaDraftStored, "agenda draft", rows);
          return yield* Effect.all(stored.map(toAgendaDraft));
        }),
      generateDraft: (input) =>
        Effect.gen(function* () {
          if (input.name.trim().length === 0) {
            return yield* Effect.fail(new InvalidInputError({ message: "Name this agenda draft" }));
          }
          if (
            input.criteria.includeStatuses.length !== 1 ||
            input.criteria.includeStatuses[0] !== "accepted"
          ) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "AI drafts can schedule accepted sessions only" }),
            );
          }
          const agenda = yield* loadAdmin(input.eventId);
          if (
            input.criteria.roomIds.some(
              (roomId) => !agenda.rooms.some((room) => room.id === roomId),
            )
          ) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "Choose rooms from this event" }),
            );
          }
          const now = new Date(yield* Clock.currentTimeMillis);
          const inserted = yield* query(database, "Could not create agenda draft", (db) =>
            db
              .insert(agendaDrafts)
              .values({
                eventId: input.eventId,
                name: input.name.trim(),
                status: "draft",
                criteria: input.criteria,
                proposal: { placements: [] },
                createdAt: now,
                updatedAt: now,
              })
              .returning()
              .execute(),
          );
          const created = yield* decodeFound(AgendaDraftStored, "Agenda draft", inserted[0]);
          const apiKey = yield* Config.option(Config.string("ANTHROPIC_API_KEY")).pipe(
            Effect.mapError(
              (cause) =>
                new AgendaGenerationErrorFailure({
                  message: "Anthropic configuration is invalid",
                  cause,
                }),
            ),
          );
          const solverInput = { agenda, criteria: input.criteria };
          const rawProposal: AgendaDraftProposalData | null = Option.isSome(apiKey)
            ? yield* requestAnthropicProposal(apiKey.value, input, agenda)
            : solveAgendaDeterministically(solverInput);
          if (rawProposal === null) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "These criteria do not have enough legal slots" }),
            );
          }
          const proposal = validateAndRepairAgendaProposal(solverInput, rawProposal);
          if (proposal === null) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "These criteria do not have enough legal slots" }),
            );
          }
          const generatedAt = new Date(yield* Clock.currentTimeMillis);
          const updated = yield* query(database, "Could not store agenda proposal", (db) =>
            db
              .update(agendaDrafts)
              .set({
                status: "generated",
                proposal,
                generatedAt,
                updatedAt: generatedAt,
              })
              .where(eq(agendaDrafts.id, created.id))
              .returning()
              .execute(),
          );
          const stored = yield* decodeFound(AgendaDraftStored, "Agenda draft", updated[0]);
          return yield* toAgendaDraft(stored);
        }),
      changeDraft: (input) =>
        Effect.gen(function* () {
          const draft = yield* loadStoredDraft(input.eventId, input.draftId);
          const now = new Date(yield* Clock.currentTimeMillis);
          if (input.action === "discard") {
            if (draft.status === "committed") {
              return yield* Effect.fail(
                new InvalidInputError({ message: "A committed draft cannot be discarded" }),
              );
            }
            const updated = yield* query(database, "Could not discard agenda draft", (db) =>
              db
                .update(agendaDrafts)
                .set({ status: "discarded", updatedAt: now })
                .where(eq(agendaDrafts.id, draft.id))
                .returning()
                .execute(),
            );
            const stored = yield* decodeFound(AgendaDraftStored, "Agenda draft", updated[0]);
            return yield* toAgendaDraft(stored);
          }
          const inserted = yield* query(database, "Could not duplicate agenda draft", (db) =>
            db
              .insert(agendaDrafts)
              .values({
                eventId: draft.eventId,
                name: `${draft.name} copy`,
                status: "draft",
                criteria: draft.criteria,
                proposal: { placements: [] },
                createdAt: now,
                updatedAt: now,
              })
              .returning()
              .execute(),
          );
          const stored = yield* decodeFound(AgendaDraftStored, "Agenda draft", inserted[0]);
          return yield* toAgendaDraft(stored);
        }),
      acceptDraft: (input) =>
        Effect.gen(function* () {
          const draft = yield* loadStoredDraft(input.eventId, input.draftId);
          if (draft.status !== "generated") {
            return yield* Effect.fail(
              new InvalidInputError({ message: "Choose a generated draft" }),
            );
          }
          const agenda = yield* loadAdmin(input.eventId);
          const selectedIds = new Set(input.submissionIds);
          if (selectedIds.size === 0 || selectedIds.size !== input.submissionIds.length) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "Choose at least one proposed change" }),
            );
          }
          const sessionById = new Map(agenda.sessions.map((session) => [session.id, session]));
          const changedPlacements = draft.proposal.placements.filter((placement) => {
            const current = sessionById.get(placement.submissionId);
            return (
              current !== undefined &&
              (current.roomId !== placement.roomId ||
                current.startsAt !== placement.startsAt ||
                current.endsAt !== placement.endsAt)
            );
          });
          if (
            [...selectedIds].some(
              (submissionId) =>
                !changedPlacements.some((placement) => placement.submissionId === submissionId),
            )
          ) {
            return yield* Effect.fail(
              new InvalidInputError({ message: "Choose changes from this draft" }),
            );
          }
          const selected = changedPlacements.filter((placement) =>
            selectedIds.has(placement.submissionId),
          );
          const resultingSessions = agenda.sessions.map((session) => {
            const placement = selected.find((item) => item.submissionId === session.id);
            return placement === undefined
              ? session
              : {
                  ...session,
                  roomId: placement.roomId,
                  startsAt: placement.startsAt,
                  endsAt: placement.endsAt,
                };
          });
          if (detectAgendaConflicts(resultingSessions).length > 0) {
            return yield* Effect.fail(
              new ScheduleConflictError({
                message: "Those selected changes conflict with the current live agenda",
              }),
            );
          }
          const changes = selected.map((placement) => ({
            eventId: input.eventId,
            submissionId: placement.submissionId,
            roomId: placement.roomId,
            startsAt: placement.startsAt,
            endsAt: placement.endsAt,
          }));
          const now = new Date(yield* Clock.currentTimeMillis);
          yield* persistScheduleChanges(input.eventId, changes, now, draft.id);
          const [updatedAgenda, updatedDraft] = yield* Effect.all([
            loadAdmin(input.eventId),
            loadStoredDraft(input.eventId, draft.id).pipe(Effect.flatMap(toAgendaDraft)),
          ]);
          return yield* decode(AcceptAgendaDraftResult, "accepted agenda draft", {
            agenda: updatedAgenda,
            draft: updatedDraft,
            changedSubmissionIds: selected.map((placement) => placement.submissionId),
          });
        }),
    };
  }),
);
