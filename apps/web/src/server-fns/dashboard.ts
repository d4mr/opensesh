import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Submissions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

export const getDashboardStats = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        // Admins only: the dashboard aggregates event-wide KPIs and every
        // recent submission — a reviewer's home is their review queue.
        const access = yield* requireEventAccess(data.eventId, "admin");
        const submissions = yield* Submissions;
        return yield* submissions.loadDashboard(
          {
            userId: access.user.userId,
            email: access.user.email,
            name: access.user.name,
            activeOrganizationId: access.user.orgId,
          },
          access.event.slug,
        );
      }),
      { require: "staff" },
    ),
  );
