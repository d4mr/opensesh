# WP0 — Scaffold: TanStack Start on Cloudflare Workers + D1/Drizzle/Effect spike

Read `AGENTS.md` at the repo root first — it is the binding contract for stack, code style, and zero-debt policy. This spec is the entire scope: build exactly this, nothing more.

## Context

Empty app (repo has only `docs/`, `research/`, `vendor/`, `AGENTS.md`). This WP produces the deployed skeleton every later work package builds on. The critical unknown to retire: **drizzle rc's Effect integration working with `effect@4.0.0-beta.106` on Workers**.

## Deliverables

### 1. App scaffold (repo root)

- TanStack Start app with **package.json at the repo root** (don't nest an `app/` dir). Use the current official TanStack Start + Cloudflare Workers setup — check TanStack's docs/templates for the Cloudflare deploy target and the `@cloudflare/vite-plugin` (`cloudflare()`) pattern so `env` bindings work in `pnpm dev`. If you scaffold via `create-cloudflare`/`create-start` into a temp dir, move files to root and delete the temp dir.
- pnpm. TypeScript strict. **SPA mode** (`ssr: false` as router/start default).
- Do not touch `docs/`, `research/`, `vendor/`.

### 2. Dependencies (pinned where stated)

- `effect@4.0.0-beta.106` (exact)
- `drizzle-orm@rc`, `drizzle-kit@rc` (record exact resolved versions in your report)
- `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query` (latest)
- Tailwind v4, shadcn/ui via CLI (below)
- Nothing else without a reason stated in your report.

### 3. Theme + shadcn

- Wire `docs/themes/greenroom.css` variables into the global stylesheet (both `:root` and `.dark` blocks) and map them for Tailwind/shadcn per current shadcn Tailwind-v4 conventions (`@theme inline` mapping). Copy the file's contents into the app stylesheet (the app must not import from `docs/`); leave a comment noting the source of truth is `docs/themes/greenroom.css`.
- `pnpm dlx shadcn@latest init` (new-york style, css variables), then install **exactly as shipped**: `button input label select table tabs dialog dropdown-menu switch badge tooltip sonner card separator`. Components live in `src/components/ui/`. Do not restyle them in this WP — tokens do the theming.
- Add the two motion curves + press-feedback rule from AGENTS.md to the global stylesheet as CSS custom properties + a `.pressable` utility (`:active { transform: scale(0.97) }`, `transition: transform 120ms var(--ease-out)`).

### 4. D1 + Drizzle + Effect spike (the point of this WP)

- Create D1 database `opensesh` via wrangler (`wrangler d1 create opensesh`); bind as `DB` in `wrangler.jsonc`.
- `src/db/schema.ts`: one table for now — `events` with `id` (text pk), `name`, `slug` (unique), `starts_at`, `ends_at`, `timezone`. Drizzle-kit config pointing migrations at `migrations/`; `drizzle-kit generate`; apply with `wrangler d1 migrations apply opensesh --local` and `--remote`. Insert one row (SQL file or tiny script): name `AI.Engineer Sandbox — NYC 2026`, slug `ai-engineer-nyc-2026`.
- **Gate — try path A first**: `drizzle-orm/effect-d1` with our pinned effect v4. Write `src/server/db.ts` exposing a `Db` Effect service. If rc's effect integration peer-depends on effect v3 or fails to typecheck/run against `4.0.0-beta.106`, **fall back to path B**: stable-API `drizzle-orm/d1` (rc package is fine) + a small wrapper: `const query = <T>(f: (db: DrizzleD1) => Promise<T>): Effect<T, DbError>` using `Effect.tryPromise` and a `DbError` tagged error. Either way the exported service surface is identical. Report which path and why.
- `src/server/runtime.ts`: the single `runPromise` boundary — `run(effect)` used by server functions; maps tagged errors exhaustively to `{ status, message }` (start with `DbError` and `NotFound`).
- `src/server/events.ts`: `getEventBySlug(slug)` Effect program (typed `NotFound` failure), decoded through an `effect/Schema` `Event` model.
- Server function `getEvent` (TanStack `createServerFn`) → runtime → program. Index route (`/`) uses TanStack Query to call it and renders the event name + dates, styled minimally with shadcn `Card` + greenroom tokens (this page is throwaway; do not gold-plate).

### 5. Scripts + deploy

- `package.json` scripts: `dev`, `typecheck` (`tsc --noEmit`), `build`, `deploy` (build + wrangler deploy), `db:generate`, `db:migrate:local`, `db:migrate:remote`.
- Deploy to workers.dev. wrangler is already authenticated on this machine.

## Acceptance (all must pass; verify each yourself)

1. `pnpm typecheck` and `pnpm build` clean.
2. `pnpm dev`: `/` renders the seeded event name from local D1 through Query → serverFn → Effect → Drizzle.
3. Deployed workers.dev URL renders the same from remote D1 (curl it; include URL + curl output snippet in report).
4. No `throw`/`any`/`@ts-ignore`/naked promises in `src/server/`.
5. Zero-debt read of your own diff before finishing: delete anything speculative.

## Report

Path A or B (with the exact error if B). Exact resolved versions of drizzle packages. Deployed URL. Files created. Any TanStack Start + Cloudflare friction worth knowing for later WPs. Commits: conventional, in coherent chunks.
