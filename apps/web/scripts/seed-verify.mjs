import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const expected = {
  events: 1,
  users: 2,
  event_members: 2,
  reviewer_tracks: 2,
  tracks: 4,
  tags: 8,
  formats: 5,
  levels: 3,
  rooms: 4,
  forms: 1,
  form_fields: 11,
  contacts: 26,
  submissions: 32,
  submission_tracks: 32,
  submission_tags: 64,
  submission_participants: 38,
  reviews: 6,
  portal_forms: 2,
  portal_form_responses: 4,
  file_requests: 0,
  file_uploads: 0,
  task_templates: 4,
  task_assignments: 54,
  email_log: 4,
};

const sql = Object.keys(expected)
  .map((table) => `SELECT '${table}' AS table_name, count(*) AS row_count FROM ${table}`)
  .join("; ");

const appDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "opensesh", "--local", "--json", "--command", sql],
  {
    cwd: appDirectory,
    encoding: "utf8",
    env: { ...process.env, WRANGLER_WRITE_LOGS: "false" },
  },
);

if (result.status !== 0) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const output = JSON.parse(result.stdout);
const responses = Array.isArray(output) ? output : [output];
const rows = responses.flatMap((response) =>
  Array.isArray(response?.results) ? response.results : [],
);
const summary = rows.map((row) => ({
  table: row.table_name,
  expected: expected[row.table_name],
  actual: row.row_count,
  status: expected[row.table_name] === row.row_count ? "ok" : "mismatch",
}));

console.table(summary);

if (summary.length !== Object.keys(expected).length || summary.some((row) => row.status !== "ok")) {
  process.stderr.write("Seed verification failed.\n");
  process.exit(1);
}

process.stdout.write("Seed verification passed.\n");
