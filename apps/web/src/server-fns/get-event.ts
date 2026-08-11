import { createServerFn } from "@tanstack/react-start";
import { NeedsFirstEvent } from "@opensesh/domain/server/errors";

export const getEvent = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUser } = await import("@opensesh/domain/server/current-user");
  const { Events } = await import("@opensesh/domain/server/repos");
  const { Effect } = await import("effect");
  const { runServer } = await import("@/server/runtime");

  return await runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const events = yield* Events;
      if (user.eventSlug === null) {
        return yield* Effect.fail(
          new NeedsFirstEvent({ message: "Create your first event to continue" }),
        );
      }
      return yield* events.getBySlug(user.eventSlug);
    }),
    { require: "session" },
  );
});
