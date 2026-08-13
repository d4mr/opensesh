import { drizzle } from "drizzle-orm/postgres-js";
import { Context, Layer } from "effect";

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

// A Worker request owns its client. Hyperdrive pools the origin connections;
// retaining Postgres.js sockets across requests violates Workers I/O isolation.
export const makeDatabase = (connectionString: string, maxConnections = 5) =>
  createDatabase(connectionString, maxConnections);

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

// Storage keys referenced by an organization's data, for R2 cleanup when that
// data is wiped. Keys under seed/ are shared static fixtures and stay.
export const organizationStorageKeys = async (
  database: Database,
  organizationId: string,
): Promise<ReadonlyArray<string>> => {
  const rows = await database.$client.unsafe<Array<{ key: string | null }>>(
    `select v.storage_key as key
       from file_versions v
       join file_uploads u on u.id = v.file_upload_id
       join contacts c on c.id = u.contact_id
       join events e on e.id = c.event_id
      where e.organization_id = $1
     union
     select c.headshot_key from contacts c join events e on e.id = c.event_id
      where e.organization_id = $1
     union
     select r.file_storage_key from resources r join events e on e.id = r.event_id
      where e.organization_id = $1
     union
     select e.logo_key from events e where e.organization_id = $1`,
    [organizationId],
  );
  return rows.flatMap((row) => (row.key === null || row.key.startsWith("seed/") ? [] : [row.key]));
};

// Deletes every row belonging to an organization — its events and their whole
// tree, CRM data, memberships, invitations, and the organization row itself —
// while leaving identity-plane users, accounts, and sessions in place.
// Pipeline cards go first: their stage FK is ON DELETE RESTRICT, so the
// organization cascade could reach a stage before the contact cascade has
// removed the cards sitting in it.
export const wipeOrganizationData = async (database: Database, organizationId: string) => {
  await database.$client.unsafe(
    `delete from crm_pipeline_cards
      where organization_contact_id in (
        select id from organization_contacts where organization_id = $1)`,
    [organizationId],
  );
  await database.$client.unsafe("delete from organizations where id = $1", [organizationId]);
};
