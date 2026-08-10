import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";

import { events } from "../db/schema";
import { DbError } from "./errors";

type DrizzleD1 = ReturnType<typeof drizzle>;
type EventRow = typeof events.$inferSelect;

const query = <T>(database: Parameters<typeof drizzle>[0], f: (db: DrizzleD1) => Promise<T>) =>
  Effect.tryPromise({
    try: () => f(drizzle(database)),
    catch: (cause) => new DbError({ message: "Could not query the database", cause }),
  });

interface DbService {
  readonly findEventBySlug: (slug: string) => Effect.Effect<EventRow | undefined, DbError>;
}

export class Db extends Context.Service<Db, DbService>()("opensesh/Db") {}

export const makeDbLive = (database: Parameters<typeof drizzle>[0]) =>
  Layer.succeed(Db, {
    findEventBySlug: (slug) =>
      query(database, (db) =>
        db.select().from(events).where(eq(events.slug, slug)).limit(1).execute(),
      ).pipe(Effect.map((rows) => rows[0])),
  });
