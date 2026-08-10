import { Events, Submissions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runSessionServer } from "@/server/runtime";

export const getDashboardStats = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runSessionServer((session) =>
      Effect.gen(function* () {
        // Resolve the slug of the event selected in the switcher — the
        // session's default slug is wrong once the organizer switches events.
        // loadDashboard still enforces the caller's event membership.
        const events = yield* Events;
        const event = yield* events.get(data.eventId);
        const submissions = yield* Submissions;
        return yield* submissions.loadDashboard(session, event.slug);
      }),
    ),
  );
