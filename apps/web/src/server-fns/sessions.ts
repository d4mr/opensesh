import {
  SessionCancelRequest,
  SessionDeleteRequest,
  SessionListRequest,
  SessionReinstateRequest,
  SubmissionTimelineRequest,
} from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Mail } from "@opensesh/domain/server/mail";
import { Sessions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

export const getSessionList = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SessionListRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const sessions = yield* Sessions;
        return yield* sessions.list(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const getSubmissionTimeline = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SubmissionTimelineRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const sessions = yield* Sessions;
        return yield* sessions.timeline(data.eventId, data.submissionId);
      }),
      { require: "staff" },
    ),
  );

export const cancelSession = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SessionCancelRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        const sessions = yield* Sessions;
        const mail = yield* Mail;
        const cancelled = yield* sessions.cancel({
          ...data,
          actor: { kind: "user", userId: access.user.userId, name: access.user.name },
        });
        yield* Effect.forEach(cancelled.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        return cancelled.result;
      }),
      { require: "staff" },
    ),
  );

export const reinstateSession = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SessionReinstateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        const sessions = yield* Sessions;
        return yield* sessions.reinstate({
          ...data,
          actor: { kind: "user", userId: access.user.userId, name: access.user.name },
        });
      }),
      { require: "staff" },
    ),
  );

export const deleteManualSession = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SessionDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const sessions = yield* Sessions;
        yield* sessions.deleteManual(data.eventId, data.submissionId);
        return { id: data.submissionId };
      }),
      { require: "staff" },
    ),
  );
