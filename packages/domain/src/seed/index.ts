import { openSeedDatabase } from "./database";
import { seedDatabase } from "./seed";
import { verifySeed } from "./verify-seed";

const database = openSeedDatabase();
try {
  await seedDatabase(database);
  await verifySeed(database);
} finally {
  await database.$client.end();
}
