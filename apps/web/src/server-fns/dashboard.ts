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
      const [eventSubmissions, eventContacts] = yield* Effect.all([
        submissions.listByEvent(event.id),
        contacts.listByEvent(event.id),
      ]);

      return {
        submissions: eventSubmissions.length,
        pending: eventSubmissions.filter((submission) => submission.status === "pending").length,
        accepted: eventSubmissions.filter((submission) => submission.status === "accepted").length,
        speakers: eventContacts.length,
      };
    }),
    { require: "staff" },
  ),
);
