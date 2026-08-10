import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Context, Effect, Layer } from "effect"

import { events } from "@/db/schema"
import { DbError } from "@/server/errors"

type DrizzleD1 = ReturnType<typeof drizzle>
type EventRow = typeof events.$inferSelect

const query = <T>(f: (db: DrizzleD1) => Promise<T>) =>
  Effect.tryPromise({
    try: () => f(drizzle(env.DB)),
    catch: (cause) => new DbError({ message: "Could not query the database", cause }),
  })

interface DbService {
  readonly findEventBySlug: (
    slug: string,
  ) => Effect.Effect<EventRow | undefined, DbError>
}

export class Db extends Context.Service<Db, DbService>()("opensesh/Db") {}

export const DbLive = Layer.succeed(Db, {
  findEventBySlug: (slug) =>
    query((db) =>
      db.select().from(events).where(eq(events.slug, slug)).limit(1).execute(),
    ).pipe(Effect.map((rows) => rows[0])),
})
