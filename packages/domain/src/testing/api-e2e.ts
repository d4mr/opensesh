import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { makeDatabase, resetPublicSchema } from "../server/db";
import { seedDatabase } from "../seed/seed";
import { verifySeed } from "../seed/verify-seed";

const API_E2E_DATABASE = "opensesh_api_e2e";
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");

const databaseUrl = (sourceUrl: string, databaseName: string) => {
  const url = new URL(sourceUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

export const resetApiE2eDatabase = async (sourceUrl: string) => {
  const admin = makeDatabase(databaseUrl(sourceUrl, "postgres"), 1);
  try {
    const existing = await admin.$client<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${API_E2E_DATABASE}) AS exists
    `;
    if (existing[0]?.exists !== true) {
      await admin.$client.unsafe(`CREATE DATABASE ${API_E2E_DATABASE}`);
    }
  } finally {
    await admin.$client.end();
  }

  const connectionString = databaseUrl(sourceUrl, API_E2E_DATABASE);
  const database = makeDatabase(connectionString, 5);
  try {
    await resetPublicSchema(database);
    await migrate(database, { migrationsFolder, migrationsSchema: "public" });
    await seedDatabase(database);
    await verifySeed(database);
  } finally {
    await database.$client.end();
  }
  return connectionString;
};
