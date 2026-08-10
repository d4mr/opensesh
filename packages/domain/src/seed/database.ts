import { makeDatabase } from "../server/db";

export const openSeedDatabase = () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    process.stderr.write("DATABASE_URL is required in apps/web/.dev.vars.\n");
    process.exit(1);
  }

  return makeDatabase(connectionString, 5);
};
