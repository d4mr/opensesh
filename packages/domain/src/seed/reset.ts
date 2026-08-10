import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { resetPublicSchema } from "../server/db";
import { openSeedDatabase } from "./database";
import { seedDatabase } from "./seed";
import { verifySeed } from "./verify-seed";

const database = openSeedDatabase();
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");

try {
  await resetPublicSchema(database);
  await migrate(database, { migrationsFolder, migrationsSchema: "public" });
  await seedDatabase(database);
  await verifySeed(database);
} finally {
  await database.$client.end();
}
