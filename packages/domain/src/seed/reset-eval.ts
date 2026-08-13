import { openSeedDatabase } from "./database";
import { resetEvalOrg } from "./seed";

// Restores the eval workspace to pristine prerequisites (run against prod by
// pointing DATABASE_URL at it). Prints any R2 objects orphaned by the wipe —
// delete them with `wrangler r2 object delete opensesh-files/<key>` if wanted.
const database = openSeedDatabase();
try {
  const keys = await resetEvalOrg(database);
  process.stdout.write("Eval workspace reset to seed prerequisites.\n");
  if (keys.length > 0) {
    process.stdout.write("Orphaned storage keys:\n");
    for (const key of keys) process.stdout.write(`  ${key}\n`);
  }
} finally {
  await database.$client.end();
}
