import { Effect, Schema } from "effect"

import { Db } from "@/server/db"
import { DbError, NotFound } from "@/server/errors"

export const Event = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  startsAt: Schema.String,
  endsAt: Schema.String,
  timezone: Schema.String,
})

export const getEventBySlug = Effect.fn("getEventBySlug")(function* (slug: string) {
  const db = yield* Db
  const row = yield* db.findEventBySlug(slug)

  if (row === undefined) {
    return yield* Effect.fail(new NotFound({ message: "Event not found" }))
  }

  return yield* Schema.decodeUnknownEffect(Event)(row).pipe(
    Effect.mapError(
      (cause) => new DbError({ message: "Stored event data is invalid", cause }),
    ),
  )
})
