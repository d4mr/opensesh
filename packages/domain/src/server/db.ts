import { drizzle } from "drizzle-orm/postgres-js";
import { Context, Layer } from "effect";

export const makeDatabase = (connectionString: string, maxConnections = 1) => {
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
