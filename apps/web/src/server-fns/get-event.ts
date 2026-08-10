import { createServerFn } from "@tanstack/react-start";

export const getEvent = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUser } = await import("@opensesh/domain/server/current-user");
  const { Events } = await import("@opensesh/domain/server/repos");
  const { Effect } = await import("effect");
  const { runServer } = await import("@/server/runtime");

  return await runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const events = yield* Events;
      return yield* events.getBySlug(user.eventSlug);
    }),
    { require: "session" },
  );
});
