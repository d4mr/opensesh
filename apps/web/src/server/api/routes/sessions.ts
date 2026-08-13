import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import { Contacts, Events, Portal, Sessions, Submissions } from "@opensesh/domain/server/repos";
import {
  SessionCancelResult,
  SessionList,
  SessionReinstateResult,
  TimelineEntry,
} from "@opensesh/domain/server/schema/sessions";
import { Submission } from "@opensesh/domain/server/schema/submissions";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const ManualSessionBody = Schema.Struct({
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  formatId: Schema.NullOr(Schema.String),
  speakerIds: Schema.Array(Schema.String),
});

const CancelBody = Schema.Struct({
  cause: Schema.Literals(["organizer", "speaker"]),
  message: Schema.optionalKey(Schema.String),
  notifySpeakers: Schema.optionalKey(Schema.Boolean),
});

const ReinstateBody = Schema.Struct({
  message: Schema.optionalKey(Schema.String),
  notifySpeakers: Schema.optionalKey(Schema.Boolean),
});

// A session is its submission seen through the program lens — one record, one
// id — so these routes keep the honest {submissionId} name and the parameter
// description says the session's own id is that id.
const sessionIdParam = {
  name: "submissionId",
  description: "The session's id, which is its submission's id — one record, one id.",
} as const;

// Sessions are the program lens over accepted submissions plus manually added
// sessions. There is no acceptance state here — the lifecycle is readiness,
// cancellation (with a recorded cause), and reinstatement.
export const sessionEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/sessions",
    operationId: "listSessions",
    summary: "List sessions",
    description:
      "Every accepted submission and manually added session with its readiness read model: speaker confirmations, schedule, deliverable and task progress, publication state, and cancellation (cancelled sessions stay listed with their cause).",
    tag: "Sessions",
    queryParams: [
      { name: "state", description: "Filter to active or cancelled sessions (default: all)." },
    ],
    successSchema: SessionList,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const sessions = yield* Sessions;
        const list = yield* sessions.list(access.event.id);
        const state = context.query.get("state");
        if (state === "active")
          return { ...list, sessions: list.sessions.filter((item) => item.cancelledAt === null) };
        if (state === "cancelled")
          return { ...list, sessions: list.sessions.filter((item) => item.cancelledAt !== null) };
        return list;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/sessions",
    operationId: "createSession",
    summary: "Create a session directly",
    description:
      "Creates an accepted session without a CFP submission — the manual-add path. Speakers must already be event contacts. Manual sessions have no submission to decline; delete them if added by mistake, or cancel them to notify speakers. Returns the underlying submission record (a session is its submission); its id works across Session, Submission, and Agenda endpoints.",
    tag: "Sessions",
    bodySchema: ManualSessionBody,
    successStatus: 201,
    successSchema: Submission,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ManualSessionBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const eventId = access.event.id;
        const title = body.title.trim();
        const speakerIds = Array.from(new Set(body.speakerIds));
        if (title.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a session title" }));
        }
        if (speakerIds.length === 0) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Every session must have a speaker" }),
          );
        }
        const contacts = yield* Contacts;
        const events = yield* Events;
        const [eventContacts, eventFormats] = yield* Effect.all([
          contacts.listByEvent(eventId),
          events.listFormats(eventId),
        ]);
        const availableContactIds = new Set(eventContacts.map((contact) => contact.id));
        if (speakerIds.some((id) => !availableContactIds.has(id))) {
          return yield* Effect.fail(
            new Forbidden({ message: "One or more speakers do not belong to this event" }),
          );
        }
        if (body.formatId !== null && !eventFormats.some((format) => format.id === body.formatId)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Choose a format from this event" }),
          );
        }
        const submissions = yield* Submissions;
        const created = yield* submissions.create({
          eventId,
          status: "accepted",
          sourceFormId: null,
          submitterContactId: null,
          title,
          description: body.description ?? "",
          formatId: body.formatId,
          levelId: null,
          language: "en",
          startsAt: null,
          endsAt: null,
          roomId: null,
          icsSequence: 0,
          scheduleDirty: false,
          capacity: null,
          ceuCredits: null,
          clientSessionId: null,
          notifiedAt: null,
          submittedAt: new Date(),
          answers: {},
          approvedSnapshot: {},
          contentReviewStatus: "approved",
          cancelledAt: null,
          cancelledBy: null,
        });
        yield* submissions.replaceParticipants(
          created.id,
          speakerIds.map((contactId, position) => ({ contactId, role: "speaker", position })),
        );
        const portal = yield* Portal;
        return yield* portal.acceptSubmission(eventId, created.id, { approveContent: true });
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/sessions/{submissionId}/cancel",
    operationId: "cancelSession",
    summary: "Cancel a session",
    description:
      "Cancels the session with a recorded cause (organizer or speaker). The acceptance stays on record and the schedule is kept as history; the session leaves the agenda and public pages, its open tasks are waived, and — when notifySpeakers is on — speakers get a cancellation email carrying a calendar cancellation if invites went out.",
    tag: "Sessions",
    pathParams: [sessionIdParam],
    bodySchema: CancelBody,
    successSchema: SessionCancelResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof CancelBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const sessions = yield* Sessions;
        const mail = yield* Mail;
        const cancelled = yield* sessions.cancel({
          eventId: access.event.id,
          submissionId: context.params.submissionId ?? "",
          cause: body.cause,
          message: body.message ?? "",
          notifySpeakers: body.notifySpeakers ?? true,
          actor: context.actor,
        });
        yield* Effect.forEach(cancelled.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        return cancelled.result;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/sessions/{submissionId}/reinstate",
    operationId: "reinstateSession",
    summary: "Reinstate a cancelled session",
    description:
      "Clears the cancellation and reopens tasks that were waived by it. With notifySpeakers on, speakers get a reinstatement email — carrying a fresh calendar invite when the session is scheduled and invites had gone out; otherwise the schedule is flagged so a fresh invite can be sent later.",
    tag: "Sessions",
    pathParams: [sessionIdParam],
    bodySchema: ReinstateBody,
    successSchema: SessionReinstateResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ReinstateBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const sessions = yield* Sessions;
        const mail = yield* Mail;
        const reinstated = yield* sessions.reinstate({
          eventId: access.event.id,
          submissionId: context.params.submissionId ?? "",
          message: body.message ?? "",
          notifySpeakers: body.notifySpeakers ?? true,
          actor: context.actor,
        });
        yield* Effect.forEach(reinstated.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        return reinstated.result;
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/events/{eventId}/sessions/{submissionId}",
    operationId: "deleteSession",
    summary: "Delete a manually added session",
    description:
      "Mistake cleanup for manual sessions only — CFP-origin sessions keep their submission history and must be cancelled instead.",
    tag: "Sessions",
    pathParams: [sessionIdParam],
    successStatus: 204,
    successSchema: Schema.Void,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const sessions = yield* Sessions;
        yield* sessions.deleteManual(access.event.id, context.params.submissionId ?? "");
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/sessions/{submissionId}/timeline",
    operationId: "getSessionTimeline",
    summary: "Get a session's timeline",
    description:
      "The merged activity log: submission lifecycle, decisions, schedule changes, cancellation and reinstatement, emails, content edits, file uploads, task completions, and speaker confirmations — newest first.",
    tag: "Sessions",
    pathParams: [sessionIdParam],
    successSchema: Schema.Array(TimelineEntry),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const sessions = yield* Sessions;
        return yield* sessions.timeline(access.event.id, context.params.submissionId ?? "");
      }),
  }),
];
