import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = resolve(appDirectory, "../../packages/domain/migrations");
const remote = process.argv.includes("--remote");
const target = remote ? "--remote" : "--local";

const migrationDirectories = readdirSync(migrationsDirectory, { withFileTypes: true }).filter(
  (entry) =>
    entry.isDirectory() && existsSync(resolve(migrationsDirectory, entry.name, "migration.sql")),
);
if (migrationDirectories.length !== 1) {
  process.stderr.write("Expected exactly one flat-schema migration.\n");
  process.exit(1);
}
const migrationPath = resolve(migrationsDirectory, migrationDirectories[0].name, "migration.sql");
const migration = readFileSync(migrationPath, "utf8");
const definitions = [...migration.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\);/g)];
const tables = definitions.map((match) => match[1]);
const dependencies = new Map(
  definitions.map((match) => [
    match[1],
    new Set([...match[2].matchAll(/REFERENCES `([^`]+)`/g)].map((reference) => reference[1])),
  ]),
);
const remaining = new Set(tables);
const dropOrder = [];

while (remaining.size > 0) {
  const next = tables.filter(
    (table) =>
      remaining.has(table) &&
      ![...remaining].some(
        (candidate) => candidate !== table && dependencies.get(candidate)?.has(table),
      ),
  );
  if (next.length === 0) {
    process.stderr.write("Could not resolve database foreign-key order.\n");
    process.exit(1);
  }
  for (const table of next) {
    dropOrder.push(table);
    remaining.delete(table);
  }
}

const resetSql = [
  ...dropOrder.map((table) => `DROP TABLE IF EXISTS \`${table}\``),
  "DROP TABLE IF EXISTS d1_migrations",
].join("; ");

const run = (args) => {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: appDirectory,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, WRANGLER_WRITE_LOGS: "false" },
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["d1", "execute", "opensesh", target, "--command", resetSql]);
run(["d1", "migrations", "apply", "opensesh", target]);
run(["d1", "execute", "opensesh", target, "--file=../../packages/domain/seed.sql"]);
