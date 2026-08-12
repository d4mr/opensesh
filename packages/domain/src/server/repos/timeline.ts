import { and, asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  contacts,
  emailLog,
  events,
  fileUploads,
  fileVersions,
  submissionActivity,
  submissionEditHistory,
  submissionParticipants,
  submissions,
  taskAssignments,
  taskTemplates,
} from "../../db/schema";
import type { Database } from "../db";
import { NotFound, type DbError } from "../errors";
import type { TimelineEntry } from "../schema/sessions";
import { query } from "./shared";

// The merged submission timeline. Each event type has exactly one durable
// source — the append-only activity log for transitions that overwrite
// columns, and the existing records (emails, edit history, file versions,
// task completions, contact confirmations) for everything else. Nothing is
// dual-written; this is the only place the sources meet.

const emailLabel: Readonly<Record<string, string>> = {
  confirmation: "Confirmation email sent",
  magic_link: "Portal sign-in link sent",
  accepted: "Acceptance email sent",
  declined: "Decline email sent",
  cancelled: "Cancellation email sent",
  task_reminder: "Task reminder sent",
  calendar_invite: "Calendar invite sent",
  custom: "Email sent",
};

const payloadString = (payload: Readonly<Record<string, unknown>>, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : null;
};

const slotDetail = (timezone: string, payload: Readonly<Record<string, unknown>>) => {
  const startsAtRaw = payloadString(payload, "startsAt");
  if (startsAtRaw === null) return null;
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);
  const roomName = payloadString(payload, "roomName");
  return roomName === null ? formatted : `${formatted} · ${roomName}`;
};

const activityEntry = (
  timezone: string,
  row: typeof submissionActivity.$inferSelect,
): TimelineEntry | null => {
  const payload = row.payload;
  if (row.type === "status_changed") {
    const from = payloadString(payload, "from");
    const to = payloadString(payload, "to");
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "status_changed",
      label: to === null ? "Status changed" : `Marked ${to}`,
      detail: from === null || to === null ? null : `was ${from}`,
      actorName: row.actorName,
    };
  }
  if (row.type === "decided") {
    const decision = payloadString(payload, "decision");
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "decided",
      label: decision === "accept" ? "Accepted" : "Declined",
      detail: null,
      actorName: row.actorName,
    };
  }
  if (row.type === "cancelled") {
    const cause = payloadString(payload, "cause");
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "cancelled",
      label: cause === "speaker" ? "Session cancelled by the speaker" : "Session cancelled",
      detail: null,
      actorName: row.actorName,
    };
  }
  if (row.type === "reinstated") {
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "reinstated",
      label: "Session reinstated",
      detail: null,
      actorName: row.actorName,
    };
  }
  if (row.type === "scheduled") {
    const detail = slotDetail(timezone, payload);
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "scheduled",
      label: detail === null ? "Removed from the schedule" : "Scheduled",
      detail,
      actorName: row.actorName,
    };
  }
  if (row.type === "content_approved") {
    return {
      id: `act_${row.id}`,
      at: row.createdAt,
      kind: "content_approved",
      label: "Content approved for publication",
      detail: null,
      actorName: row.actorName,
    };
  }
  return null;
};

export const loadTimeline = (
  database: Database,
  eventId: string,
  submissionId: string,
): Effect.Effect<ReadonlyArray<TimelineEntry>, DbError | NotFound> =>
  Effect.gen(function* () {
    const submissionRows = yield* query(database, "Could not load submission", (db) =>
      db
        .select({
          id: submissions.id,
          sourceFormId: submissions.sourceFormId,
          createdAt: submissions.createdAt,
          submittedAt: submissions.submittedAt,
          timezone: events.timezone,
        })
        .from(submissions)
        .innerJoin(events, eq(events.id, submissions.eventId))
        .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, eventId)))
        .limit(1)
        .execute(),
    );
    const submission = submissionRows[0];
    if (submission === undefined) {
      return yield* Effect.fail(new NotFound({ message: "Submission not found" }));
    }
    const [activityRows, emailRows, editRows, fileRows, taskRows, confirmationRows] =
      yield* Effect.all([
      query(database, "Could not load submission activity", (db) =>
        db
          .select()
          .from(submissionActivity)
          .where(eq(submissionActivity.submissionId, submissionId))
          .orderBy(asc(submissionActivity.createdAt))
          .execute(),
      ),
      query(database, "Could not load submission emails", (db) =>
        db
          .select({
            id: emailLog.id,
            type: emailLog.type,
            subject: emailLog.subject,
            recipient: emailLog.recipient,
            createdAt: emailLog.createdAt,
          })
          .from(emailLog)
          .where(eq(emailLog.submissionId, submissionId))
          .execute(),
      ),
      query(database, "Could not load edit history", (db) =>
        db
          .select()
          .from(submissionEditHistory)
          .where(eq(submissionEditHistory.submissionId, submissionId))
          .execute(),
      ),
      query(database, "Could not load submission files", (db) =>
        db
          .select({
            id: fileVersions.id,
            filename: fileVersions.filename,
            uploaderName: fileVersions.uploaderName,
            uploadedAt: fileVersions.uploadedAt,
          })
          .from(fileVersions)
          .innerJoin(fileUploads, eq(fileUploads.id, fileVersions.fileUploadId))
          .where(eq(fileUploads.submissionId, submissionId))
          .execute(),
      ),
      query(database, "Could not load submission tasks", (db) =>
        db
          .select({
            id: taskAssignments.id,
            completedAt: taskAssignments.completedAt,
            status: taskAssignments.status,
            title: taskTemplates.title,
          })
          .from(taskAssignments)
          .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
          .where(eq(taskAssignments.submissionId, submissionId))
          .execute(),
      ),
      query(database, "Could not load speaker confirmations", (db) =>
        db
          .select({
            contactId: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            confirmedAt: contacts.confirmedAt,
          })
          .from(submissionParticipants)
          .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
          .where(eq(submissionParticipants.submissionId, submissionId))
          .execute(),
      ),
    ]);

    const entries: Array<TimelineEntry> = [
      {
        id: "created",
        at: submission.createdAt,
        kind: "created",
        label: submission.sourceFormId === null ? "Session created manually" : "Submission created",
        detail: null,
        actorName: null,
      },
      ...(submission.submittedAt === null || submission.sourceFormId === null
        ? []
        : [
            {
              id: "submitted",
              at: submission.submittedAt,
              kind: "submitted" as const,
              label: "Submitted for review",
              detail: null,
              actorName: null,
            },
          ]),
      ...activityRows.flatMap((row) => {
        const entry = activityEntry(submission.timezone, row);
        return entry === null ? [] : [entry];
      }),
      ...emailRows.map((row) => ({
        id: `email_${row.id}`,
        at: row.createdAt,
        kind: "email" as const,
        label: emailLabel[row.type] ?? "Email sent",
        detail: `${row.subject} — ${row.recipient}`,
        actorName: null,
      })),
      ...editRows.flatMap((row) => [
        {
          id: `edit_${row.id}`,
          at: row.createdAt,
          kind: "content_edited" as const,
          label: `Content edited (${row.changedFields.length} ${row.changedFields.length === 1 ? "field" : "fields"})`,
          detail: row.changedFields.join(", "),
          actorName: row.authorName,
        },
        ...(row.reviewedAt === null || row.approvalStatus === "pending_review"
          ? []
          : [
              {
                id: `editreview_${row.id}`,
                at: row.reviewedAt,
                kind: "content_edited" as const,
                label: row.approvalStatus === "approved" ? "Edit approved" : "Edit rejected",
                detail: row.changedFields.join(", "),
                actorName: null,
              },
            ]),
      ]),
      ...fileRows.map((row) => ({
        id: `file_${row.id}`,
        at: row.uploadedAt,
        kind: "file" as const,
        label: "File uploaded",
        detail: row.filename,
        actorName: row.uploaderName,
      })),
      ...taskRows.flatMap((row) =>
        row.completedAt === null || row.status !== "done"
          ? []
          : [
              {
                id: `task_${row.id}`,
                at: row.completedAt,
                kind: "task" as const,
                label: "Task completed",
                detail: row.title,
                actorName: null,
              },
            ],
      ),
      ...confirmationRows.flatMap((row) =>
        row.confirmedAt === null
          ? []
          : [
              {
                id: `confirm_${row.contactId}`,
                at: row.confirmedAt,
                kind: "speaker_confirmed" as const,
                label: `${row.firstName} ${row.lastName} confirmed participation`,
                detail: null,
                actorName: null,
              },
            ],
      ),
    ];
    return entries.sort((left, right) => right.at.getTime() - left.at.getTime());
  });
