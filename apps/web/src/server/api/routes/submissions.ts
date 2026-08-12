import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput, NotFound } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import { Contacts, Events, Portal, ReviewDesk, Submissions } from "@opensesh/domain/server/repos";
import {
  DecisionResult,
  ReviewDeskDetail,
  ReviewDeskList,
  StatusChangeResult,
} from "@opensesh/domain/server/schema/review-desk";
import { Contact, Submission } from "@opensesh/domain/server/schema/submissions";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const DecideBody = Schema.Struct({
  submissionIds: Schema.Array(Schema.String),
  decision: Schema.Literals(["accept", "decline"]),
  feedback: Schema.String,
  confirmRedecide: Schema.optionalKey(Schema.Boolean),
  approveContent: Schema.optionalKey(Schema.Boolean),
});

const StatusBody = Schema.Struct({
  status: Schema.Literals(["draft", "pending", "maybe", "accepted", "declined", "withdrawn"]),
});

const ManualSessionBody = Schema.Struct({
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  formatId: Schema.NullOr(Schema.String),
  speakerIds: Schema.Array(Schema.String),
});

const submissionKind = (value: string | null) =>
  value === "abstract" ? ("abstract" as const) : ("session" as const);

export const submissionEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/submissions",
    operationId: "listSubmissions",
    summary: "List submissions",
    description:
      "The review-desk view of submissions: status, code, title, tracks, format, speakers, rating, review counts.",
    tag: "Submissions",
    queryParams: [
      {
        name: "kind",
        description: 'The submission stage: "abstract" (CFP inbox) or "session" (default).',
      },
      { name: "status", description: "Filter to one status (pending, accepted, declined, …)." },
    ],
    successSchema: ReviewDeskList,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviewDesk = yield* ReviewDesk;
        const list = yield* reviewDesk.list(
          access.event.id,
          submissionKind(context.query.get("kind")),
        );
        const status = context.query.get("status");
        return status === null
          ? list
          : { ...list, submissions: list.submissions.filter((item) => item.status === status) };
      }),
  }),
  endpoint({
    method: "GET",
    path: "/events/{eventId}/submissions/{submissionId}",
    operationId: "getSubmission",
    summary: "Get a submission",
    description: "Full detail: answers, participants, reviews, decision state, and history.",
    tag: "Submissions",
    successSchema: ReviewDeskDetail,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.detail(access.event.id, context.params.submissionId ?? "");
      }),
  }),
  endpoint({
    method: "PATCH",
    path: "/events/{eventId}/submissions/{submissionId}",
    operationId: "changeSubmissionStatus",
    summary: "Change a submission's status",
    tag: "Submissions",
    bodySchema: StatusBody,
    successSchema: StatusChangeResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof StatusBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.changeStatus(
          access.event.id,
          context.params.submissionId ?? "",
          body.status,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/submissions/decide",
    operationId: "decideSubmissions",
    summary: "Accept or decline submissions",
    description:
      "Applies the decision to every submission id, snapshots accepted content for the program, and sends decision emails. Set confirmRedecide to change already-decided submissions.",
    tag: "Submissions",
    bodySchema: DecideBody,
    successSchema: DecisionResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof DecideBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        if (body.submissionIds.length === 0) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Pass at least one submission id" }),
          );
        }
        const reviewDesk = yield* ReviewDesk;
        const mail = yield* Mail;
        const decision = yield* reviewDesk.decide({
          eventId: access.event.id,
          submissionIds: body.submissionIds,
          decision: body.decision,
          feedback: body.feedback,
          confirmRedecide: body.confirmRedecide ?? false,
          approveContent: body.approveContent ?? false,
        });
        yield* Effect.forEach(
          decision.deliveries,
          (delivery) => mail.sendLogged(delivery.logId, delivery.mail),
          { concurrency: 5 },
        );
        return decision.result;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/sessions",
    operationId: "createSession",
    summary: "Create a session directly",
    description:
      "Creates an accepted session without a CFP submission — the manual-add path. Speakers must already be event contacts.",
    tag: "Submissions",
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
          kind: "session",
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
    method: "GET",
    path: "/events/{eventId}/speakers/{contactId}",
    operationId: "getSpeaker",
    summary: "Get an event speaker",
    tag: "Speakers",
    successSchema: Contact,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const contacts = yield* Contacts;
        const contact = yield* contacts.get(context.params.contactId ?? "");
        if (contact.eventId !== access.event.id) {
          return yield* Effect.fail(new NotFound({ message: "Speaker not found in this event" }));
        }
        return contact;
      }),
  }),
];
