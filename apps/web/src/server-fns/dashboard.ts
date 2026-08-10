import { Submissions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { runSessionServer } from "@/server/runtime";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () =>
  runSessionServer((session, eventSlug) =>
    Effect.gen(function* () {
      const submissions = yield* Submissions;
      return yield* submissions.loadDashboard(session, eventSlug);
    }),
  ),
);
