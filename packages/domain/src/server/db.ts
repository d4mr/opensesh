import { drizzle } from "drizzle-orm/postgres-js";
import { Context, Layer } from "effect";

// One client per isolate+connection string: connection setup costs several
// round trips to the origin, so per-request clients multiply latency.
const clients = new Map<string, ReturnType<typeof createDatabase>>();

const createDatabase = (connectionString: string, maxConnections: number) => {
  const url = new URL(connectionString);
  url.searchParams.delete("sslrootcert");
  return drizzle({
    connection: {
      url: url.toString(),
      max: maxConnections,
      prepare: true,
      fetch_types: false,
      idle_timeout: 10,
      onnotice: () => undefined,
    },
  });
};

export const makeDatabase = (connectionString: string, maxConnections = 5) => {
  const key = `${connectionString}#${maxConnections}`;
  const cached = clients.get(key);
  if (cached !== undefined) return cached;
  const database = createDatabase(connectionString, maxConnections);
  clients.set(key, database);
  return database;
};

export type Database = ReturnType<typeof makeDatabase>;

interface DbService {
  readonly database: Database;
}

export class Db extends Context.Service<Db, DbService>()("opensesh/Db") {}

export const makeDbLive = (connectionString: string) =>
  Layer.succeed(Db, { database: makeDatabase(connectionString) });

export const resetPublicSchema = async (database: Database) => {
  await database.$client.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await database.$client.unsafe("DROP SCHEMA public CASCADE");
  await database.$client.unsafe("CREATE SCHEMA public");
};

export const wipeSeedData = (database: Database) =>
  database.$client.unsafe("TRUNCATE TABLE verifications, users, organizations CASCADE");
