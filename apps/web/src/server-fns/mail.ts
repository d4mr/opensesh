import {
  DeliverableReminderRequest,
  EventMailRequest,
  Forbidden,
  InvalidInput,
  ReminderRequest,
  RetryEmailRequest,
} from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Mail } from "@opensesh/domain/server/mail";
import { Events, MailAdmin } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireAdminEvent = Effect.fn("requireMailAdminEvent")(function* (eventId: string) {
  const user = yield* getCurrentUser;
  if (!user.roles.admin) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage event email" }));
  }
  const events = yield* Events;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  }
  return event;
});

const summarize = (results: ReadonlyArray<{ readonly status: "demo" | "sent" | "failed" }>) => ({
  attempted: results.length,
  demo: results.filter((result) => result.status === "demo").length,
  sent: results.filter((result) => result.status === "sent").length,
  failed: results.filter((result) => result.status === "failed").length,
});

export const getAdminEmails = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EventMailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const admin = yield* MailAdmin;
        return yield* admin.list(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const getCalendarInviteSummary = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EventMailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const admin = yield* MailAdmin;
        return yield* admin.calendarSummary(data.eventId);
      }),
      { require: "admin" },
    ),
  );

export const sendCalendarInvites = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(EventMailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const origin = new URL(getRequest().url).origin;
        const admin = yield* MailAdmin;
        const mail = yield* Mail;
        const queued = yield* admin.queueCalendarInvites(data.eventId, origin);
        const results = yield* Effect.forEach(queued, (item) => mail.sendQueued(item.logId), {
          concurrency: 5,
        });
        return summarize(results);
      }),
      { require: "admin" },
    ),
  );

export const sendTaskReminders = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReminderRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const origin = new URL(getRequest().url).origin;
        const admin = yield* MailAdmin;
        const mail = yield* Mail;
        const requested = data.contactIds ?? [data.contactId];
        const batches = yield* Effect.forEach(
          requested,
          (contactId) => admin.queueTaskReminders(data.eventId, contactId, origin),
          { concurrency: 5 },
        );
        const queued = batches.flat();
        const results = yield* Effect.forEach(queued, (item) => mail.sendQueued(item.logId), {
          concurrency: 5,
        });
        return summarize(results);
      }),
      { require: "admin" },
    ),
  );

export const sendDeliverableReminders = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(DeliverableReminderRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const origin = new URL(getRequest().url).origin;
        const admin = yield* MailAdmin;
        const mail = yield* Mail;
        const queued = yield* admin.queueDeliverableReminders(
          data.eventId,
          data.contactIds,
          data.requirementId ?? null,
          origin,
        );
        const results = yield* Effect.forEach(queued, (item) => mail.sendQueued(item.logId), {
          concurrency: 5,
        });
        return summarize(results);
      }),
      { require: "admin" },
    ),
  );

export const retryEmail = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RetryEmailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const admin = yield* MailAdmin;
        const entry = yield* admin.get(data.eventId, data.emailId);
        if (entry.status !== "failed") {
          return yield* Effect.fail(
            new InvalidInput({ message: "Only failed email can be retried" }),
          );
        }
        const mail = yield* Mail;
        return yield* mail.sendQueued(entry.id);
      }),
      { require: "admin" },
    ),
  );
