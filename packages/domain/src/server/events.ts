import { Effect } from "effect";

import { Events } from "./repos/events";

export { Event } from "./schema/core";

export const getEventBySlug = Effect.fn("getEventBySlug")(function* (slug: string) {
  const events = yield* Events;
  return yield* events.getBySlug(slug);
});
