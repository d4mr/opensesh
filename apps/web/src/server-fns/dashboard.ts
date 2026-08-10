import { Contacts, Events, Submissions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { runServer } from "@/server/runtime";

const EVENT_SLUG = "ai-engineer-nyc-2026";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const events = yield* Events;
      const submissions = yield* Submissions;
      const contacts = yield* Contacts;
      const event = yield* events.getBySlug(EVENT_SLUG);
      const [eventSubmissions, recentSubmissions, eventContacts] = yield* Effect.all([
        submissions.listByEvent(event.id),
        submissions.listDashboardByEvent(event.id),
        contacts.listByEvent(event.id),
      ]);

      const activity = new Map<string, { abstracts: number; sessions: number }>();
      for (const submission of eventSubmissions) {
        const date = submission.createdAt.toISOString().slice(0, 10);
        const point = activity.get(date) ?? { abstracts: 0, sessions: 0 };
        if (submission.kind === "abstract") point.abstracts += 1;
        else point.sessions += 1;
        activity.set(date, point);
      }

      return {
        submissions: eventSubmissions.length,
        pending: eventSubmissions.filter((submission) => submission.status === "pending").length,
        accepted: eventSubmissions.filter((submission) => submission.status === "accepted").length,
        speakers: eventContacts.length,
        activity: Array.from(activity, ([date, values]) => ({ date, ...values })).sort(
          (left, right) => left.date.localeCompare(right.date),
        ),
        recentSubmissions,
      };
    }),
    { require: "staff" },
  ),
);
