# WP2b — Pivot to PlanetScale Postgres + organizations layer + TS seed

Read `AGENTS.md` first — it already reflects the Postgres decision. Prereqs: WP0–WP2 merged. This WP replaces D1 with PlanetScale Postgres via Hyperdrive, adds the multi-tenancy substrate, and converts the seed to TypeScript. All schema work lands as ONE regenerated flat init migration (FLAT rule).

## A — Database swap (D1 → PlanetScale Postgres via Hyperdrive)

- Convert every drizzle table from `sqlite-core` to `pg-core`: `timestamptz` for timestamps, `jsonb` for JSON columns, `text` + check or pg enums for status/kind/decision literals (pick one style, use it everywhere, note the choice), keep text ids + `$defaultFn` nanoid.
- Driver: postgres-js through the **Hyperdrive binding** (`env.HYPERDRIVE.connectionString`) inside `makeDbLive`. Local dev: `wrangler dev` Hyperdrive local connection string via `.dev.vars` / `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (follow current Hyperdrive + Workers docs; the connection string is provided in `.dev.vars`, never committed).
- Try `drizzle-orm/effect-postgres` ONCE against pinned effect (check whether the `effect-core` `TaggedErrorClass` incompatibility WP0 found is fixed in the current rc; try upgrading drizzle rc to latest first). If it works, adopt it (report the versions); if not, keep the `Effect.tryPromise` wrapper exactly as-is with the pg driver.
- Repos: fix any SQLite-isms the type-checker or tests surface (timestamp handling, returning clauses, upsert syntax differences). The query-builder surface should mostly survive; list what changed in the report.
- better-auth drizzle adapter: `provider: "pg"`.
- wrangler.jsonc: remove `d1_databases`, add `hyperdrive` binding (id will be created — see Ops notes), add `"placement": { "mode": "smart" }`.
- Delete `packages/domain/migrations/*` and `seed.sql`; regenerate ONE init migration with drizzle-kit for pg. `db:reset` = drop schema public cascade → apply init → seed (script, one command). Remove all D1 scripts.

## B — Organizations (multi-tenancy substrate; no tenant UI)

- Tables (identity plane): `organizations` (id, name, slug), org membership via **better-auth `organization` plugin** — run its CLI/docs to see required tables, write them as first-class pg-core definitions in our schema (same ownership pattern as WP2 auth tables). `events.organization_id` FK (the sanctioned crossing per AGENTS.md plane-separation rule).
- `CurrentUser` gains org context: `{ userId, email, orgId, roles: {...} }` — resolved from active org membership (single org for now; no switcher).
- Enforcement seam: server-fn runtime helper's role check verifies org membership → event belongs to org. All existing queries already scope by event; do not add per-query org filters beyond the event→org check.
- Seed: one org "AI.Engineer", slug `ai-engineer`; Dana owner, Rey member; event linked to it.

## C — TypeScript seed

- Replace seed.sql with `packages/domain/src/seed/` TS module inserting via drizzle (NOT raw SQL) — same content/counts as the current seed (event, library, 26 contacts, 32 submissions with exact status mix, reviews, task templates/assignments, portal forms/responses, the ONE planted Hall A conflict, email log). Runnable via `pnpm seed` (tsx or a worker-less node script with a direct pg connection from `.dev.vars`). `seed:verify` keeps working (port to pg).
- Idempotent = wipe-and-refill (delete all rows in FK order or truncate cascade, then insert).

## Ops notes (environment)

- The PlanetScale connection string will be present in `.dev.vars` as `DATABASE_URL` (and `WRANGLER_HYPERDRIVE_LOCAL...` as needed) before you start — if it's missing, STOP and report immediately rather than mocking anything.
- Hyperdrive config: create with `npx wrangler hyperdrive create opensesh --connection-string="$DATABASE_URL"` (read it from .dev.vars; never print the string in your output/logs) and put the returned id in wrangler.jsonc.
- Deploy + verify prod as usual. `.dev.vars` stays gitignored; assert that before finishing.

## Acceptance

1. `pnpm check && pnpm build && pnpm test` clean; NO references to D1/sqlite remain (`grep -ri "d1\|sqlite" apps packages --include="*.ts" --include="*.jsonc"` — only allowed hits: none; report any exceptions with justification).
2. `pnpm db:reset` from nothing: schema applied + seeded + `seed:verify` passes against PlanetScale.
3. Full WP2 auth flow still works in dev AND on the deployed workers.dev URL (login via magic link, role switcher, shells) — now backed by Postgres.
4. `/` renders the seeded event in prod; report timing (curl -w) — target comparable to D1 baseline (~300ms total).
5. Org checks: demo users belong to AI.Engineer org; a server fn requiring admin verifies org membership (prove with a probe).
6. Zero-debt self-review; report: effect-postgres verdict (adopted or not, with error), repo changes list, exact versions, anything WP3–7 should know.
