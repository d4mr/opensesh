import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput, NotFound } from "@opensesh/domain/server/errors";
import { Contacts, ReviewDesk } from "@opensesh/domain/server/repos";
import {
  DecisionResult,
  InformResult,
  ReviewDeskDetail,
  ReviewDeskList,
  StatusChangeResult,
} from "@opensesh/domain/server/schema/review-desk";
import { Contact } from "@opensesh/domain/server/schema/submissions";
import { Effect, Schema } from "effect";

import { MailQueue } from "../../mail-queue";
import { endpoint, type ApiEndpoint } from "../types";

const DecideBody = Schema.Struct({
  submissionIds: Schema.Array(Schema.String),
  decision: Schema.Literals(["accept", "decline"]),
  confirmRedecide: Schema.optionalKey(Schema.Boolean),
  approveContent: Schema.optionalKey(Schema.Boolean),
});

const InformBody = Schema.Struct({
  submissionIds: Schema.Array(Schema.String),
  feedback: Schema.optionalKey(Schema.String),
});

const StatusBody = Schema.Struct({
  status: Schema.Literals(["draft", "pending", "maybe", "accepted", "declined", "withdrawn"]),
});

export const submissionEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/submissions",
    operationId: "listSubmissions",
    summary: "List submissions",
    description:
      "The review-desk view of CFP submissions across their whole lifecycle: status, code, title, tracks, format, speakers, rating, review counts. Sessions (accepted submissions and manually created sessions) live under the Sessions endpoints.",
    tag: "Submissions",
    queryParams: [
      { name: "status", description: "Filter to one status (pending, accepted, declined, …)." },
    ],
    successSchema: ReviewDeskList,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviewDesk = yield* ReviewDesk;
        const list = yield* reviewDesk.list(access.event.id);
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
          context.actor,
        );
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/submissions/decide",
    operationId: "decideSubmissions",
    summary: "Accept or decline submissions",
    description:
      "Applies the decision to every submission id and snapshots accepted content for the program. Set confirmRedecide to change an informed final decision.",
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
        const decision = yield* reviewDesk.decide({
          eventId: access.event.id,
          submissionIds: body.submissionIds,
          decision: body.decision,
          confirmRedecide: body.confirmRedecide ?? false,
          approveContent: body.approveContent ?? false,
          actor: context.actor,
        });
        return decision.result;
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/submissions/inform",
    operationId: "informSubmissions",
    summary: "Queue decision emails",
    description: "Queues one decision email to each uninformed submission's submitter.",
    tag: "Submissions",
    bodySchema: InformBody,
    successSchema: InformResult,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof InformBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const reviewDesk = yield* ReviewDesk;
        const informed = yield* reviewDesk.inform({
          eventId: access.event.id,
          submissionIds: body.submissionIds,
          feedback: body.feedback ?? "",
          actor: context.actor,
        });
        const queue = yield* MailQueue;
        yield* queue.enqueue(informed.logIds);
        return informed.result;
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
