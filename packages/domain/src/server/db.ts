import { drizzle } from "drizzle-orm/d1";
import { Context, Layer } from "effect";

const makeDatabase = (database: D1Database) => drizzle(database);

export type Database = ReturnType<typeof makeDatabase>;

interface DbService {
  readonly database: Database;
}

export class Db extends Context.Service<Db, DbService>()("opensesh/Db") {}

export const makeDbLive = (database: D1Database) =>
  Layer.succeed(Db, { database: makeDatabase(database) });
