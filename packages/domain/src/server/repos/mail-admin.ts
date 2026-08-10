import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  contacts,
  emailLog,
  events,
  rooms,
  submissionParticipants,
  submissions,
  taskAssignments,
  taskTemplates,
} from "../../db/schema";
import { Db, type Database } from "../db";
import type { DbError, NotFound } from "../errors";
import { buildCalendarInvite } from "../mail/ics";
import { calendarInvite, taskReminder } from "../mail/templates";
import type { AdminEmail, CalendarInviteSummary } from "../schema/mail";
import { EmailLogEntry } from "../schema/portal";
import { decodeFound, decodeMany, query } from "./shared";

interface QueuedMail {
  readonly logId: string;
}

interface MailAdminService {
  readonly list: (eventId: string) => Effect.Effect<ReadonlyArray<AdminEmail>, DbError>;
  readonly get: (eventId: string, id: string) => Effect.Effect<AdminEmail, DbError | NotFound>;
  readonly calendarSummary: (eventId: string) => Effect.Effect<CalendarInviteSummary, DbError>;
  readonly queueCalendarInvites: (
    eventId: string,
    portalOrigin: string,
  ) => Effect.Effect<ReadonlyArray<QueuedMail>, DbError>;
  readonly queueTaskReminders: (
    eventId: string,
    contactId: string | null,
    portalOrigin: string,
  ) => Effect.Effect<ReadonlyArray<QueuedMail>, DbError>;
}

export class MailAdmin extends Context.Service<MailAdmin, MailAdminService>()(
  "opensesh/MailAdmin",
) {}

const calendarRows = (database: Database, eventId: string) =>
  query(database, "Could not load scheduled speakers", (db) =>
    db
      .select({
        eventName: events.name,
        logoUrl: events.logoUrl,
        timezone: events.timezone,
        submissionId: submissions.id,
        title: submissions.title,
        description: submissions.description,
        startsAt: submissions.startsAt,
        endsAt: submissions.endsAt,
        icsSequence: submissions.icsSequence,
        scheduleDirty: submissions.scheduleDirty,
        room: rooms.name,
        contactId: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
      })
      .from(submissions)
      .innerJoin(events, eq(events.id, submissions.eventId))
      .innerJoin(rooms, eq(rooms.id, submissions.roomId))
      .innerJoin(
        submissionParticipants,
        and(
          eq(submissionParticipants.submissionId, submissions.id),
          eq(submissionParticipants.role, "speaker"),
        ),
      )
      .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
      .where(
        and(
          eq(submissions.eventId, eventId),
          eq(submissions.status, "accepted"),
          isNotNull(submissions.startsAt),
          isNotNull(submissions.endsAt),
          isNotNull(submissions.roomId),
        ),
      )
      .orderBy(asc(submissions.startsAt), asc(contacts.lastName), asc(contacts.firstName))
      .execute(),
  );

const sentCalendarRows = (database: Database, eventId: string) =>
  query(database, "Could not load calendar delivery history", (db) =>
    db
      .select({
        submissionId: emailLog.submissionId,
        contactId: emailLog.contactId,
        sequence: emailLog.icsSequence,
      })
      .from(emailLog)
      .where(
        and(
          eq(emailLog.eventId, eventId),
          eq(emailLog.type, "calendar_invite"),
          inArray(emailLog.status, ["demo", "sent"]),
        ),
      )
      .execute(),
  );

const calendarState = Effect.fn("calendarMailState")(function* (
  database: Database,
  eventId: string,
) {
  const [scheduled, sent] = yield* Effect.all(
    [calendarRows(database, eventId), sentCalendarRows(database, eventId)],
    { concurrency: "unbounded" },
  );
  const sentKeys = new Set(
    sent.flatMap((row) =>
      row.submissionId === null || row.contactId === null || row.sequence === null
        ? []
        : [`${row.submissionId}:${row.contactId}:${row.sequence}`],
    ),
  );
  return {
    scheduled,
    sentKeys,
    affected: scheduled.filter(
      (row) =>
        row.scheduleDirty ||
        !sentKeys.has(`${row.submissionId}:${row.contactId}:${row.icsSequence}`),
    ),
  };
});

export const MailAdminLive = Layer.effect(
  MailAdmin,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      list: (eventId) =>
        query(database, "Could not list event emails", (db) =>
          db
            .select()
            .from(emailLog)
            .where(eq(emailLog.eventId, eventId))
            .orderBy(desc(emailLog.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(EmailLogEntry, "email", rows))),
      get: (eventId, id) =>
        query(database, "Could not load email", (db) =>
          db
            .select()
            .from(emailLog)
            .where(and(eq(emailLog.id, id), eq(emailLog.eventId, eventId)))
            .limit(1)
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(EmailLogEntry, "Email", rows[0]))),
      calendarSummary: (eventId) =>
        calendarState(database, eventId).pipe(
          Effect.map((state) => ({
            scheduledSpeakers: state.scheduled.length,
            affectedSpeakers: state.affected.length,
          })),
        ),
      queueCalendarInvites: (eventId, portalOrigin) =>
        Effect.gen(function* () {
          const state = yield* calendarState(database, eventId);
          const dirtySubmissions = new Map<string, number>();
          for (const row of state.affected) {
            if (!row.scheduleDirty || dirtySubmissions.has(row.submissionId)) continue;
            const hasCurrentDelivery = state.scheduled
              .filter((scheduled) => scheduled.submissionId === row.submissionId)
              .some((scheduled) =>
                state.sentKeys.has(
                  `${scheduled.submissionId}:${scheduled.contactId}:${scheduled.icsSequence}`,
                ),
              );
            dirtySubmissions.set(
              row.submissionId,
              hasCurrentDelivery ? row.icsSequence + 1 : row.icsSequence,
            );
          }
          for (const [submissionId, sequence] of dirtySubmissions) {
            yield* query(database, "Could not advance calendar sequence", (db) =>
              db
                .update(submissions)
                .set({ icsSequence: sequence, scheduleDirty: false, updatedAt: new Date() })
                .where(eq(submissions.id, submissionId))
                .execute(),
            );
          }
          const queued = state.affected
            .map((row) => {
              const startsAt = row.startsAt;
              const endsAt = row.endsAt;
              const sequence = dirtySubmissions.get(row.submissionId) ?? row.icsSequence;
              if (startsAt === null || endsAt === null) return null;
              const portalUrl = `${portalOrigin}/portal/submissions`;
              const rendered = calendarInvite({
                eventName: row.eventName,
                logoUrl: row.logoUrl,
                speakerName: row.firstName,
                sessionTitle: row.title,
                startsAt,
                endsAt,
                timezone: row.timezone,
                room: row.room,
                portalUrl,
              });
              const ics = buildCalendarInvite({
                id: row.submissionId,
                title: row.title,
                startsAt,
                endsAt,
                timezone: row.timezone,
                room: row.room,
                description: row.description,
                portalUrl,
                sequence,
              });
              return {
                eventId,
                contactId: row.contactId,
                submissionId: row.submissionId,
                type: "calendar_invite" as const,
                recipient: row.email,
                subject: rendered.subject,
                body: rendered.text,
                htmlBody: rendered.html,
                icsAttached: true,
                icsContent: ics,
                icsSequence: sequence,
                status: "queued" as const,
                provider: null,
                providerId: null,
                error: null,
                sentAt: null,
              };
            })
            .filter((row) => row !== null);
          if (queued.length === 0) return [];
          return yield* query(database, "Could not queue calendar invitations", (db) =>
            db.insert(emailLog).values(queued).returning({ logId: emailLog.id }).execute(),
          );
        }),
      queueTaskReminders: (eventId, requestedContactId, portalOrigin) =>
        Effect.gen(function* () {
          const [assignments, participants] = yield* Effect.all(
            [
              query(database, "Could not load outstanding tasks", (db) =>
                db
                  .select({
                    assignmentId: taskAssignments.id,
                    contactId: taskAssignments.contactId,
                    submissionId: taskAssignments.submissionId,
                    task: taskTemplates.title,
                    dueDate: taskTemplates.dueDate,
                    submissionCode: submissions.code,
                  })
                  .from(taskAssignments)
                  .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                  .leftJoin(submissions, eq(submissions.id, taskAssignments.submissionId))
                  .where(
                    and(eq(taskTemplates.eventId, eventId), eq(taskAssignments.status, "todo")),
                  )
                  .orderBy(asc(taskTemplates.position))
                  .execute(),
              ),
              query(database, "Could not load reminder recipients", (db) =>
                db
                  .select({
                    submissionId: submissionParticipants.submissionId,
                    contactId: contacts.id,
                    email: contacts.email,
                    firstName: contacts.firstName,
                    eventName: events.name,
                    logoUrl: events.logoUrl,
                  })
                  .from(submissionParticipants)
                  .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                  .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                  .innerJoin(events, eq(events.id, submissions.eventId))
                  .where(
                    and(
                      eq(submissions.eventId, eventId),
                      eq(submissionParticipants.role, "speaker"),
                    ),
                  )
                  .execute(),
              ),
            ],
            { concurrency: "unbounded" },
          );
          const people = new Map(participants.map((row) => [row.contactId, row]));
          const tasks = new Map<string, Map<string, string>>();
          for (const assignment of assignments) {
            const contactIds =
              assignment.contactId === null
                ? participants
                    .filter((row) => row.submissionId === assignment.submissionId)
                    .map((row) => row.contactId)
                : [assignment.contactId];
            for (const contactId of contactIds) {
              if (requestedContactId !== null && contactId !== requestedContactId) continue;
              const contactTasks = tasks.get(contactId) ?? new Map<string, string>();
              const task =
                assignment.submissionCode === null
                  ? assignment.task
                  : `${assignment.task} · ${assignment.submissionCode}`;
              const due =
                assignment.dueDate === null
                  ? "No due date"
                  : `Due ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(assignment.dueDate)}`;
              contactTasks.set(assignment.assignmentId, `${task} · ${due}`);
              tasks.set(contactId, contactTasks);
            }
          }
          const queued = Array.from(tasks, ([contactId, contactTasks]) => {
            const person = people.get(contactId);
            if (person === undefined) return null;
            const portalUrl = `${portalOrigin}/portal/tasks`;
            const rendered = taskReminder({
              eventName: person.eventName,
              logoUrl: person.logoUrl,
              speakerName: person.firstName,
              tasks: Array.from(contactTasks.values()),
              portalUrl,
            });
            return {
              eventId,
              contactId,
              submissionId: null,
              type: "task_reminder" as const,
              recipient: person.email,
              subject: rendered.subject,
              body: rendered.text,
              htmlBody: rendered.html,
              icsAttached: false,
              icsContent: null,
              icsSequence: null,
              status: "queued" as const,
              provider: null,
              providerId: null,
              error: null,
              sentAt: null,
            };
          }).filter((row) => row !== null);
          if (queued.length === 0) return [];
          return yield* query(database, "Could not queue task reminders", (db) =>
            db.insert(emailLog).values(queued).returning({ logId: emailLog.id }).execute(),
          );
        }),
    };
  }),
);
