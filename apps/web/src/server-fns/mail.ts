import {
  DeliverableReminderRequest,
  EventMailRequest,
  InvalidInput,
  ReminderRequest,
  RetryEmailRequest,
} from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Mail } from "@opensesh/domain/server/mail";
import { MailAdmin } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";
import { MailQueue } from "@/server/mail-queue";

const requireAdminEvent = (eventId: string) => requireEventAccess(eventId, "admin");

export const getAdminEmails = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(EventMailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const admin = yield* MailAdmin;
        return yield* admin.list(data.eventId);
      }),
      { require: "staff" },
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
      { require: "staff" },
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
        const queued = yield* admin.queueCalendarInvites(data.eventId, origin);
        const queue = yield* MailQueue;
        yield* queue.enqueue(queued.map((entry) => entry.logId));
        return { queued: queued.length };
      }),
      { require: "staff" },
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
        const requested = data.contactIds ?? [data.contactId];
        const batches = yield* Effect.forEach(
          requested,
          (contactId) => admin.queueTaskReminders(data.eventId, contactId, origin),
          { concurrency: 5 },
        );
        const queued = batches.flat();
        const queue = yield* MailQueue;
        yield* queue.enqueue(queued.map((entry) => entry.logId));
        return { queued: queued.length };
      }),
      { require: "staff" },
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
        const queued = yield* admin.queueDeliverableReminders(
          data.eventId,
          data.contactIds,
          data.requirementId ?? null,
          origin,
        );
        const queue = yield* MailQueue;
        yield* queue.enqueue(queued.map((entry) => entry.logId));
        return { queued: queued.length };
      }),
      { require: "staff" },
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
        yield* mail.requeueFailed(entry.id);
        const queue = yield* MailQueue;
        yield* queue.enqueue([entry.id]);
        return { id: entry.id, status: "queued" as const, error: null };
      }),
      { require: "staff" },
    ),
  );
