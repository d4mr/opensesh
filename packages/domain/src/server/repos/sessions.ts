import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contacts,
  emailLog,
  events,
  formats,
  rooms,
  sessionFileRequirementAssignments,
  submissionActivity,
  submissionParticipants,
  submissions,
  submissionTracks,
  taskAssignments,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import { InvalidInput, NotFound, type DbError } from "../errors";
import { buildCalendarCancellation, buildCalendarInvite } from "../mail/ics";
import { JsonObject, NullableDate, NullableNumber, NullableString } from "../schema/common";
import {
  renderCancellationEmail,
  renderReinstatementEmail,
  SessionList,
  type SessionCancelResult,
  type SessionReinstateResult,
  type TimelineEntry,
} from "../schema/sessions";
import { ContentApprovalStatus, SessionCancelledBy } from "../schema/submissions";
import { activityActorColumns, decode, decodeMany, query, type ActivityActor } from "./shared";
import { loadTimeline } from "./timeline";

const RawSessionRow = Schema.Struct({
  submissionId: Schema.String,
  eventId: Schema.String,
  code: Schema.String,
  title: Schema.String,
  description: Schema.String,
  formatName: NullableString,
  sourceFormId: NullableString,
  notifiedAt: NullableDate,
  startsAt: NullableDate,
  endsAt: NullableDate,
  roomId: NullableString,
  roomName: NullableString,
  contentReviewStatus: ContentApprovalStatus,
  approvedSnapshot: JsonObject,
  cancelledAt: NullableDate,
  cancelledBy: Schema.NullOr(SessionCancelledBy),
  capacity: NullableNumber,
  createdAt: Schema.Date,
  trackId: NullableString,
  trackName: NullableString,
  trackColor: NullableString,
  contactId: NullableString,
  contactFirstName: NullableString,
  contactLastName: NullableString,
  contactEmail: NullableString,
  contactHeadshotUrl: NullableString,
  contactConfirmedAt: NullableDate,
  participantRole: NullableString,
  participantPosition: NullableNumber,
});
type RawSessionRow = typeof RawSessionRow.Type;

interface SessionsService {
  // Every accepted submission — active AND cancelled; the surface shows
  // cancelled rows with their cause rather than hiding history.
  readonly list: (eventId: string) => Effect.Effect<SessionList, DbError>;
  readonly cancel: (input: {
    readonly eventId: string;
    readonly submissionId: string;
    readonly cause: SessionCancelledBy;
    readonly message: string;
    readonly notifySpeakers: boolean;
    readonly actor: ActivityActor;
  }) => Effect.Effect<
    { readonly result: SessionCancelResult; readonly logIds: ReadonlyArray<string> },
    DbError | NotFound | InvalidInput
  >;
  readonly reinstate: (input: {
    readonly eventId: string;
    readonly submissionId: string;
    readonly message: string;
    readonly notifySpeakers: boolean;
    readonly actor: ActivityActor;
  }) => Effect.Effect<
    { readonly result: SessionReinstateResult; readonly logIds: ReadonlyArray<string> },
    DbError | NotFound | InvalidInput
  >;
  // Mistake cleanup for manually created sessions only — CFP-origin rows
  // keep their submission history and are cancelled instead.
  readonly deleteManual: (
    eventId: string,
    submissionId: string,
  ) => Effect.Effect<void, DbError | NotFound | InvalidInput>;
  readonly timeline: (
    eventId: string,
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<TimelineEntry>, DbError | NotFound>;
}

export class Sessions extends Context.Service<Sessions, SessionsService>()("opensesh/Sessions") {}

type CancelTransaction =
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid"; readonly message: string }
  | {
      readonly kind: "success";
      readonly cancelledAt: Date;
      readonly waivedTasks: number;
      readonly logIds: ReadonlyArray<string>;
    };

type ReinstateTransaction =
  | { readonly kind: "notFound" }
  | { readonly kind: "invalid"; readonly message: string }
  | {
      readonly kind: "success";
      readonly reopenedTasks: number;
      readonly logIds: ReadonlyArray<string>;
      readonly reinvited: boolean;
    };

export const SessionsLive = Layer.effect(
  Sessions,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const listRows = (eventId: string) =>
      query(database, "Could not load sessions", (db) =>
        db
          .select({
            submissionId: submissions.id,
            eventId: submissions.eventId,
            code: submissions.code,
            title: submissions.title,
            description: submissions.description,
            formatName: formats.name,
            sourceFormId: submissions.sourceFormId,
            notifiedAt: submissions.notifiedAt,
            startsAt: submissions.startsAt,
            endsAt: submissions.endsAt,
            roomId: submissions.roomId,
            roomName: rooms.name,
            contentReviewStatus: submissions.contentReviewStatus,
            approvedSnapshot: submissions.approvedSnapshot,
            cancelledAt: submissions.cancelledAt,
            cancelledBy: submissions.cancelledBy,
            capacity: submissions.capacity,
            createdAt: submissions.createdAt,
            trackId: tracks.id,
            trackName: tracks.name,
            trackColor: tracks.color,
            contactId: contacts.id,
            contactFirstName: contacts.firstName,
            contactLastName: contacts.lastName,
            contactEmail: contacts.email,
            contactHeadshotUrl: contacts.headshotUrl,
            contactConfirmedAt: contacts.confirmedAt,
            participantRole: submissionParticipants.role,
            participantPosition: submissionParticipants.position,
          })
          .from(submissions)
          .leftJoin(formats, eq(formats.id, submissions.formatId))
          .leftJoin(rooms, eq(rooms.id, submissions.roomId))
          .leftJoin(submissionTracks, eq(submissionTracks.submissionId, submissions.id))
          .leftJoin(tracks, eq(tracks.id, submissionTracks.trackId))
          .leftJoin(submissionParticipants, eq(submissionParticipants.submissionId, submissions.id))
          .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
          .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "accepted")))
          .orderBy(
            asc(submissions.startsAt),
            desc(submissions.createdAt),
            asc(submissionParticipants.position),
          )
          .execute(),
      );

    const deliverableCounts = (eventId: string) =>
      query(database, "Could not count session deliverables", (db) =>
        db
          .select({
            submissionId: sessionFileRequirementAssignments.submissionId,
            total: count(),
            uploaded: count(
              sql`case when ${sessionFileRequirementAssignments.status} = 'uploaded' then 1 end`,
            ),
          })
          .from(sessionFileRequirementAssignments)
          .innerJoin(
            submissions,
            eq(submissions.id, sessionFileRequirementAssignments.submissionId),
          )
          .where(eq(submissions.eventId, eventId))
          .groupBy(sessionFileRequirementAssignments.submissionId)
          .execute(),
      );

    const taskCounts = (eventId: string) =>
      query(database, "Could not count session tasks", (db) =>
        db
          .select({
            submissionId: taskAssignments.submissionId,
            total: count(sql`case when ${taskAssignments.status} <> 'waived' then 1 end`),
            done: count(sql`case when ${taskAssignments.status} = 'done' then 1 end`),
          })
          .from(taskAssignments)
          .innerJoin(submissions, eq(submissions.id, taskAssignments.submissionId))
          .where(and(eq(submissions.eventId, eventId), isNotNull(taskAssignments.submissionId)))
          .groupBy(taskAssignments.submissionId)
          .execute(),
      );

    return {
      list: (eventId) =>
        Effect.all([
          listRows(eventId).pipe(
            Effect.flatMap((rows) => decodeMany(RawSessionRow, "session row", rows)),
          ),
          deliverableCounts(eventId),
          taskCounts(eventId),
        ]).pipe(
          Effect.flatMap(([rows, deliverables, tasksRows]) => {
            const deliverableMap = new Map(
              deliverables.map((row) => [row.submissionId, row] as const),
            );
            const taskMap = new Map(
              tasksRows.flatMap((row) =>
                row.submissionId === null ? [] : [[row.submissionId, row] as const],
              ),
            );
            interface MutableSession {
              readonly base: RawSessionRow;
              readonly tracks: Map<string, { id: string; name: string; color: string }>;
              readonly speakers: Map<
                string,
                {
                  id: string;
                  name: string;
                  email: string;
                  role: string;
                  position: number;
                  headshotUrl: string | null;
                  confirmedAt: Date | null;
                }
              >;
            }
            const grouped = new Map<string, MutableSession>();
            for (const row of rows) {
              let item = grouped.get(row.submissionId);
              if (item === undefined) {
                item = { base: row, tracks: new Map(), speakers: new Map() };
                grouped.set(row.submissionId, item);
              }
              if (row.trackId !== null && row.trackName !== null && row.trackColor !== null) {
                item.tracks.set(row.trackId, {
                  id: row.trackId,
                  name: row.trackName,
                  color: row.trackColor,
                });
              }
              if (
                row.contactId !== null &&
                row.contactFirstName !== null &&
                row.contactLastName !== null &&
                row.contactEmail !== null
              ) {
                item.speakers.set(row.contactId, {
                  id: row.contactId,
                  name: `${row.contactFirstName} ${row.contactLastName}`.trim(),
                  email: row.contactEmail,
                  role: row.participantRole ?? "Speaker",
                  position: row.participantPosition ?? 0,
                  headshotUrl: row.contactHeadshotUrl,
                  confirmedAt: row.contactConfirmedAt,
                });
              }
            }
            const sessions = Array.from(grouped.values()).map((item) => {
              const deliverableRow = deliverableMap.get(item.base.submissionId);
              const taskRow = taskMap.get(item.base.submissionId);
              return {
                id: item.base.submissionId,
                eventId: item.base.eventId,
                code: item.base.code,
                title: item.base.title,
                description: item.base.description,
                format: item.base.formatName,
                source: item.base.sourceFormId === null ? ("manual" as const) : ("cfp" as const),
                // Manual sessions have no decision to send; only CFP sessions
                // can be waiting on the inform step.
                decisionSent: item.base.sourceFormId === null || item.base.notifiedAt !== null,
                tracks: Array.from(item.tracks.values()),
                speakers: Array.from(item.speakers.values()).sort(
                  (left, right) => left.position - right.position,
                ),
                startsAt: item.base.startsAt,
                endsAt: item.base.endsAt,
                roomId: item.base.roomId,
                roomName: item.base.roomName,
                deliverablesTotal: deliverableRow?.total ?? 0,
                deliverablesUploaded: deliverableRow?.uploaded ?? 0,
                tasksTotal: taskRow?.total ?? 0,
                tasksDone: taskRow?.done ?? 0,
                contentReviewStatus: item.base.contentReviewStatus,
                publicationApproved:
                  item.base.contentReviewStatus === "approved" &&
                  Object.keys(item.base.approvedSnapshot).length > 0,
                cancelledAt: item.base.cancelledAt,
                cancelledBy: item.base.cancelledBy,
                capacity: item.base.capacity,
                createdAt: item.base.createdAt,
              };
            });
            const trackMap = new Map<string, { id: string; name: string; color: string }>();
            const formatSet = new Set<string>();
            for (const session of sessions) {
              for (const track of session.tracks) trackMap.set(track.id, track);
              if (session.format !== null) formatSet.add(session.format);
            }
            return decode(SessionList, "session list", {
              sessions,
              tracks: Array.from(trackMap.values()),
              formats: Array.from(formatSet).sort(),
            });
          }),
        ),

      cancel: (input) =>
        query(database, "Could not cancel session", (db) =>
          db.transaction(async (transaction): Promise<CancelTransaction> => {
            const target = (
              await transaction
                .select({
                  id: submissions.id,
                  status: submissions.status,
                  cancelledAt: submissions.cancelledAt,
                  title: submissions.title,
                  description: submissions.description,
                  startsAt: submissions.startsAt,
                  endsAt: submissions.endsAt,
                  icsSequence: submissions.icsSequence,
                  roomName: rooms.name,
                  eventName: events.name,
                  timezone: events.timezone,
                })
                .from(submissions)
                .innerJoin(events, eq(events.id, submissions.eventId))
                .leftJoin(rooms, eq(rooms.id, submissions.roomId))
                .where(
                  and(
                    eq(submissions.id, input.submissionId),
                    eq(submissions.eventId, input.eventId),
                  ),
                )
                .for("update", { of: submissions })
            )[0];
            if (target === undefined) return { kind: "notFound" };
            if (target.status !== "accepted") {
              return { kind: "invalid", message: "Only accepted sessions can be cancelled" };
            }
            if (target.cancelledAt !== null) {
              return { kind: "invalid", message: "This session is already cancelled" };
            }
            const now = new Date();

            // An ICS CANCEL leaves calendars only when invites went out for
            // the current slot; it must reuse the invite UID with a bumped
            // sequence.
            const hadInvites =
              input.notifySpeakers &&
              target.startsAt !== null &&
              target.endsAt !== null &&
              (
                await transaction
                  .select({ id: emailLog.id })
                  .from(emailLog)
                  .where(
                    and(
                      eq(emailLog.submissionId, input.submissionId),
                      eq(emailLog.type, "calendar_invite"),
                    ),
                  )
                  .limit(1)
              ).length > 0;
            const cancelSequence = target.icsSequence + 1;
            const ics =
              hadInvites && target.startsAt !== null && target.endsAt !== null
                ? buildCalendarCancellation({
                    id: input.submissionId,
                    title: target.title,
                    startsAt: target.startsAt,
                    endsAt: target.endsAt,
                    timezone: target.timezone,
                    room: target.roomName ?? "TBD",
                    description: target.description,
                    portalUrl: "https://opensesh.io/portal",
                    sequence: cancelSequence,
                  })
                : null;

            await transaction
              .update(submissions)
              .set({
                cancelledAt: now,
                cancelledBy: input.cause,
                updatedAt: now,
                ...(ics === null ? {} : { icsSequence: cancelSequence }),
              })
              .where(eq(submissions.id, input.submissionId));

            // Open per-session work is moot for a cancelled session; contact
            // scoped tasks may span other sessions and stay untouched.
            const waived = await transaction
              .update(taskAssignments)
              .set({ status: "waived", completedAt: null })
              .where(
                and(
                  eq(taskAssignments.submissionId, input.submissionId),
                  eq(taskAssignments.status, "todo"),
                ),
              )
              .returning({ id: taskAssignments.id });

            await transaction.insert(submissionActivity).values({
              submissionId: input.submissionId,
              type: "cancelled",
              ...activityActorColumns(input.actor),
              payload: { cause: input.cause },
            });
            // A scheduled session leaving the grid makes any published
            // agenda stale — surface the republish nudge.
            if (target.startsAt !== null) {
              await transaction
                .update(events)
                .set({ agendaDirty: true, updatedAt: now })
                .where(eq(events.id, input.eventId));
            }

            let logIds: ReadonlyArray<string> = [];
            if (input.notifySpeakers) {
              const participants = await transaction
                .select({
                  contactId: contacts.id,
                  email: contacts.email,
                  firstName: contacts.firstName,
                })
                .from(submissionParticipants)
                .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .where(eq(submissionParticipants.submissionId, input.submissionId));
              if (participants.length > 0) {
                const inserted = await transaction
                  .insert(emailLog)
                  .values(
                    participants.map((participant) => {
                      const rendered = renderCancellationEmail({
                        eventName: target.eventName,
                        speakerName: participant.firstName,
                        submissionTitle: target.title,
                        cause: input.cause,
                        message: input.message,
                      });
                      return {
                        eventId: input.eventId,
                        contactId: participant.contactId,
                        submissionId: input.submissionId,
                        type: "cancelled" as const,
                        recipient: participant.email,
                        subject: rendered.subject,
                        body: rendered.text,
                        htmlBody: rendered.html,
                        icsAttached: ics !== null,
                        icsContent: ics,
                        icsSequence: ics === null ? null : cancelSequence,
                        status: "queued" as const,
                        provider: null,
                        providerId: null,
                        error: null,
                        sentAt: null,
                      };
                    }),
                  )
                  .returning({ id: emailLog.id });
                logIds = inserted.map((row) => row.id);
              }
            }
            return { kind: "success", cancelledAt: now, waivedTasks: waived.length, logIds };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound") {
                return yield* Effect.fail(new NotFound({ message: "Session not found" }));
              }
              if (outcome.kind === "invalid") {
                return yield* Effect.fail(new InvalidInput({ message: outcome.message }));
              }
              return {
                result: {
                  id: input.submissionId,
                  cancelledAt: outcome.cancelledAt,
                  cancelledBy: input.cause,
                  createdEmails: outcome.logIds.length,
                  waivedTasks: outcome.waivedTasks,
                },
                logIds: outcome.logIds,
              };
            }),
          ),
        ),

      reinstate: (input) =>
        query(database, "Could not reinstate session", (db) =>
          db.transaction(async (transaction): Promise<ReinstateTransaction> => {
            const target = (
              await transaction
                .select({
                  id: submissions.id,
                  cancelledAt: submissions.cancelledAt,
                  title: submissions.title,
                  description: submissions.description,
                  startsAt: submissions.startsAt,
                  endsAt: submissions.endsAt,
                  icsSequence: submissions.icsSequence,
                  roomName: rooms.name,
                  eventName: events.name,
                  timezone: events.timezone,
                })
                .from(submissions)
                .innerJoin(events, eq(events.id, submissions.eventId))
                .leftJoin(rooms, eq(rooms.id, submissions.roomId))
                .where(
                  and(
                    eq(submissions.id, input.submissionId),
                    eq(submissions.eventId, input.eventId),
                  ),
                )
                .for("update", { of: submissions })
            )[0];
            if (target === undefined) return { kind: "notFound" };
            if (target.cancelledAt === null) {
              return { kind: "invalid", message: "This session is not cancelled" };
            }
            const now = new Date();
            // When the session is scheduled and the original invite chain
            // exists, the reinstatement email carries a fresh METHOD:REQUEST
            // (same UID, bumped sequence) that undoes the earlier CANCEL in
            // speakers' calendars directly.
            const scheduled = target.startsAt !== null && target.endsAt !== null;
            const hadInvites =
              input.notifySpeakers &&
              scheduled &&
              (
                await transaction
                  .select({ id: emailLog.id })
                  .from(emailLog)
                  .where(
                    and(
                      eq(emailLog.submissionId, input.submissionId),
                      eq(emailLog.type, "calendar_invite"),
                    ),
                  )
                  .limit(1)
              ).length > 0;
            const inviteSequence = target.icsSequence + 1;
            const ics =
              hadInvites && target.startsAt !== null && target.endsAt !== null
                ? buildCalendarInvite({
                    id: input.submissionId,
                    title: target.title,
                    startsAt: target.startsAt,
                    endsAt: target.endsAt,
                    timezone: target.timezone,
                    room: target.roomName ?? "TBD",
                    description: target.description,
                    portalUrl: "https://opensesh.io/portal",
                    sequence: inviteSequence,
                  })
                : null;
            await transaction
              .update(submissions)
              .set({
                cancelledAt: null,
                cancelledBy: null,
                updatedAt: now,
                // The re-invite goes out with this email; otherwise the slot
                // still owes a fresh invite, so the schedule stays dirty for
                // the Communications flow.
                ...(ics === null
                  ? target.startsAt === null
                    ? {}
                    : { scheduleDirty: true }
                  : { icsSequence: inviteSequence, scheduleDirty: false }),
              })
              .where(eq(submissions.id, input.submissionId));
            // Reopens every waived per-session task: cancellation is the only
            // flow that waives them in bulk, so this is its inverse.
            const reopened = await transaction
              .update(taskAssignments)
              .set({ status: "todo", completedAt: null })
              .where(
                and(
                  eq(taskAssignments.submissionId, input.submissionId),
                  eq(taskAssignments.status, "waived"),
                ),
              )
              .returning({ id: taskAssignments.id });
            await transaction.insert(submissionActivity).values({
              submissionId: input.submissionId,
              type: "reinstated",
              ...activityActorColumns(input.actor),
              payload: {},
            });
            if (target.startsAt !== null) {
              await transaction
                .update(events)
                .set({ agendaDirty: true, updatedAt: now })
                .where(eq(events.id, input.eventId));
            }
            let logIds: ReadonlyArray<string> = [];
            if (input.notifySpeakers) {
              const participants = await transaction
                .select({
                  contactId: contacts.id,
                  email: contacts.email,
                  firstName: contacts.firstName,
                })
                .from(submissionParticipants)
                .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .where(eq(submissionParticipants.submissionId, input.submissionId));
              if (participants.length > 0) {
                const inserted = await transaction
                  .insert(emailLog)
                  .values(
                    participants.map((participant) => {
                      const rendered = renderReinstatementEmail({
                        eventName: target.eventName,
                        speakerName: participant.firstName,
                        submissionTitle: target.title,
                        message: input.message,
                        reinvited: ics !== null,
                      });
                      return {
                        eventId: input.eventId,
                        contactId: participant.contactId,
                        submissionId: input.submissionId,
                        type: "reinstated" as const,
                        recipient: participant.email,
                        subject: rendered.subject,
                        body: rendered.text,
                        htmlBody: rendered.html,
                        icsAttached: ics !== null,
                        icsContent: ics,
                        icsSequence: ics === null ? null : inviteSequence,
                        status: "queued" as const,
                        provider: null,
                        providerId: null,
                        error: null,
                        sentAt: null,
                      };
                    }),
                  )
                  .returning({ id: emailLog.id });
                logIds = inserted.map((row) => row.id);
              }
            }
            return {
              kind: "success",
              reopenedTasks: reopened.length,
              logIds,
              reinvited: ics !== null,
            };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound") {
                return yield* Effect.fail(new NotFound({ message: "Session not found" }));
              }
              if (outcome.kind === "invalid") {
                return yield* Effect.fail(new InvalidInput({ message: outcome.message }));
              }
              return {
                result: {
                  id: input.submissionId,
                  reopenedTasks: outcome.reopenedTasks,
                  createdEmails: outcome.logIds.length,
                  calendarReinvited: outcome.reinvited,
                },
                logIds: outcome.logIds,
              };
            }),
          ),
        ),

      deleteManual: (eventId, submissionId) =>
        query(database, "Could not delete session", (db) =>
          db.transaction(async (transaction) => {
            const target = (
              await transaction
                .select({ id: submissions.id, sourceFormId: submissions.sourceFormId })
                .from(submissions)
                .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, eventId)))
                .for("update")
            )[0];
            if (target === undefined) return { kind: "notFound" as const };
            if (target.sourceFormId !== null) {
              return {
                kind: "invalid" as const,
                message:
                  "This session came from a submission and keeps its history — cancel it instead",
              };
            }
            await transaction.delete(submissions).where(eq(submissions.id, submissionId));
            return { kind: "success" as const };
          }),
        ).pipe(
          Effect.flatMap((outcome) =>
            Effect.gen(function* () {
              if (outcome.kind === "notFound") {
                return yield* Effect.fail(new NotFound({ message: "Session not found" }));
              }
              if (outcome.kind === "invalid") {
                return yield* Effect.fail(new InvalidInput({ message: outcome.message }));
              }
            }),
          ),
        ),

      timeline: (eventId, submissionId) => loadTimeline(database, eventId, submissionId),
    };
  }),
);
