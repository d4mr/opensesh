import { openSeedDatabase } from "./database";
import { verifySeed } from "./verify-seed";

const database = openSeedDatabase();
try {
  await verifySeed(database);
} finally {
  await database.$client.end();
}
