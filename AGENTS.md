# opensesh.io — Agent Contract

Open-source clone of Sessionboard's Program module (conference CFP → review → speaker portal → agenda → publish). Competition entry; judged on a browser walkthrough, product taste, and speed. Deadline-critical: build exactly what the spec says, nothing more.

## Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If multiple interpretations exist, pick the simplest and note the choice in your report.
- If a simpler approach exists than what the spec implies, say so in your report — but build the spec.

## Simplicity first (zero-debt policy)

**Minimum code that solves the problem. Nothing speculative.**
- No features beyond the spec. No abstractions for single-use code. No "flexibility" nobody asked for. No error handling for impossible states.
- If you write 200 lines and it could be 50, rewrite it.
- No TODO comments — finish it or report it as open. No dead code, no commented-out code.
- Do not add dependencies beyond those the spec lists (plus whatever the shadcn CLI itself vendors in).
- **Pre-prod is FLAT — no migrations, no backwards compatibility, ANYWHERE.** Until the user explicitly declares a production target: there is exactly ONE migration (the init). A schema change = edit the schema → delete the migrations dir → regenerate a single fresh init migration → drop/recreate the Postgres schema → apply → `pnpm seed`. Never write an ALTER chain, a data backfill, a versioned/deprecated field, or any compat code path for an old shape (schema, API, or serialized data). The seed is the only data that exists; blowing the database away is always correct. Keep a `pnpm db:reset` script that does the drop→apply→seed dance.

## Stack (fixed — do not substitute)

- **TanStack Start** (`@tanstack/react-start`) on **Cloudflare Workers**, SPA mode (`ssr: false` default). TanStack Router (file routes), TanStack Query (all server state), TanStack Table (lists), TanStack Form (forms).
- **Effect v4 beta — pinned `effect@4.0.0-beta.106`**. The Effect monorepo is vendored at `vendor/effect` at the same tag. **v4 ≠ v3 ≠ your training data.** For any Effect API question, read `vendor/effect/packages/effect/src` and `vendor/effect/.patterns/` first. Never write Effect code from memory.
- **Database: PlanetScale Postgres, reached from the Worker via Hyperdrive** (edge connection pooling; binding `HYPERDRIVE`, local dev via local connection string env). **Drizzle owns schema and migrations**: `pg-core` table definitions, `drizzle-orm@rc` + `drizzle-kit@rc`, single flat init migration (see FLAT rule) applied with drizzle-kit. Real `jsonb`, `timestamptz`, pg enums where natural. Driver: postgres-js (or node-postgres if the Workers compat story demands) inside the Db service only. Try the official Effect integration `drizzle-orm/effect-postgres` ONCE against our pinned effect v4 (WP0 found `effect-core` broken vs beta.106 — it may be fixed in a newer rc); if it fails, keep the proven `Effect.tryPromise` wrapper pattern. No Durable Objects, no D1. Backend code runs in the Worker, in `createServerFn` handlers that run Effect programs through the shared runtime helper.
- **better-auth** for auth (magic links, Drizzle adapter). **Cloudflare Email** `send_email` binding for mail (dev: log-only Mail layer).
- **Tailwind v4 + shadcn/ui**: components are installed with the **shadcn CLI, exactly as shipped** (`pnpm dlx shadcn@latest add <component>`), then modified in `src/components/ui/` only when a spec requires it. Never hand-roll a lookalike of a component shadcn ships. Theme tokens: `docs/themes/greenroom.css` (light+dark) — wire once into the global stylesheet; never hardcode colors in components.
- pnpm. TypeScript strict.
- **Monorepo (minimal)**: pnpm workspace + Vite+ (`vp run` with caching). Exactly two packages — `apps/web` (the TanStack Start app: routes, components, server fns) and `packages/domain` (drizzle tables, effect/Schema models, Effect services/repos, mail templates+ICS — **no React, no TanStack imports; enforced by its package.json deps**). `apps/web` imports `@opensesh/domain`. Do not add more packages without a spec saying so — in particular there is deliberately **no `apps/api`**: the public REST API is server routes in `apps/web/src/routes/api/v1/*` (thin handlers over domain services). It is ALSO exposed as **api.opensesh.io** — a wrangler route (`api.opensesh.io/*`) on the same Worker plus a host-based rewrite (`api.opensesh.io/v1/x` ≡ `/api/v1/x`; the api host serves a JSON index at `/`). Same deployable, vanity hostname. Root scripts fan out via `vp run` (`pnpm check` = all packages).

Path mapping: older specs may say `src/server/*` / `src/db/*` — post-monorepo these live in `packages/domain/src/*`; route/component paths live in `apps/web/src/*`.

## Effect rules (packages/domain/**, and any server fn)

- Every domain operation: `Effect` with typed failures via `Data.TaggedError` (`NotFound`, `Forbidden`, `FormClosed`, `SubmissionLimitReached`, `ScheduleConflict`, …). **No `throw`, no naked `Promise`, no `any`, no `@ts-ignore`, no unchecked `as`.**
- Services via `Effect.Service` + Layers (Db from the D1 binding, Mail, Ics, Clock where it matters). Env/config via `Config`. `Effect.runPromise` is called in exactly one place — the server-fn runtime helper — where tagged errors are exhaustively `Match`ed to `{ status, message }`.
- Drizzle table definitions are the DB truth; `effect/Schema` models are the domain truth (decode drizzle rows at the repo boundary). One schema drives RPC input validation, form validation (via `Schema.standardSchemaV1`), and API responses. No hand-written duplicate types.
- **Dialect hygiene**: Postgres-isms must never leak past the Db service — the product may later also ship a SQLite deployment flavor. (1) Repos use the drizzle query builder only — no raw SQL fragments; a genuine escape hatch goes through one reviewed helper in the Db service. (2) The seed is TypeScript through drizzle inserts, not a .sql file. (3) Driver types, pool/transaction mechanics, and Hyperdrive specifics stay inside the Db service; app and repo code never see them.
- **Plane separation (tenancy fault line)**: identity-plane tables (`users`, auth tables, `organizations`/org membership) may only be referenced from event-plane tables via `event_members` or `contacts` — never a direct FK to `users` from any event-scoped table. The sanctioned crossings are exactly `event_members.user_id` and `events.organization_id`. This keeps a future control-plane/tenant-plane split a clean cut.

## UI rules

- **Density: Vercel-grade, compact.** The reference feel is Vercel's dashboard — dense, quiet, information-first. Airy/Google-ish spacing is explicitly rejected by the user. Admin surfaces: `text-sm` (13–14px) body, compact row heights (~32–36px), tight paddings; whitespace is spent on grouping, never on inflation.
- **Follow shadcn's official blocks EXACTLY for structural UI** (sidebar/shell, dashboard, login, tables): install the closest block via `pnpm dlx shadcn@latest add <block>` (e.g. `sidebar-07`, `dashboard-01`, `login-03`) and adapt content/routes — never invent a layout shadcn already ships. SidebarProvider/SidebarTrigger/SidebarInset composition, trigger placement in the header, collapse-to-icon behavior, full-width hover targets on menu rows: all exactly as the blocks do it.
- **The docs-page TOP DEMO is the canonical usage — read its SOURCE.** For any shadcn component, the rendered demo at the top of its docs page is the best demonstration of intended composition; the inline code snippets below are simplified. Fetch the demo's actual source (registry item `<component>-demo` via `pnpm dlx shadcn@latest add <component>-demo` into a scratch dir, the `/r/` registry JSON, or the shadcn-ui GitHub repo) and pattern our usage on it. When your usage diverges from the top demo's composition, that's a smell — justify it or fix it.

- Status colors come from the `--status-*` tokens (pending/maybe/accepted/declined/withdrawn). Semantic, never repurposed.
- Session codes (`SESS-4`) render in mono with `tabular-nums`.
- Motion doctrine (from Emil Kowalski's design-engineering skill — full text at `~/.agents/skills/emil-design-eng/SKILL.md`):
  - Curves, declared once: `--ease-out: cubic-bezier(0.23,1,0.32,1)`; `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`. Never built-in `ease-in`.
  - Durations: press 100–160ms · popover 125–200ms · dropdown 150–250ms · modal/drawer 200–300ms. Nothing over 300ms.
  - Every pressable: `:active { transform: scale(0.97) }`. Enters via `@starting-style`, from `scale(0.95)`+opacity, never `scale(0)`. Popovers scale from trigger origin.
  - CSS transitions over keyframes (interruptible). Animate `transform`/`opacity` only. `transition: all` is banned. Hover behind `@media (hover: hover)`. Respect `prefers-reduced-motion`. No animation on keyboard-triggered actions.
- Speed is a judged feature: optimistic updates on every mutation, no spinner theater, instant-feeling navigation.

## Commands — Vite+ toolchain

We use **Vite+** (`vp`, https://viteplus.dev — beta, MIT) as the unified toolchain: `vp dev` · `vp build` · `vp check` (oxlint + oxfmt + types) · `vp test` (vitest). Package scripts wrap it: `pnpm dev` → `vp dev`, `pnpm check` → `vp check`, `pnpm test` → `vp test`, `pnpm build` → `vp build`, plus `pnpm deploy` (build + wrangler) and `pnpm seed`. It runs the exact same `vite.config.ts` (TanStack Start + Cloudflare are Vite plugins). If a `vp` command hits a beta incompatibility, the script may fall back to the plain tool (`vite`/`tsc --noEmit`/`vitest`) — note the fallback and why in your report; never silently drop a check.

A work package is done only when `pnpm check && pnpm build` pass and the spec's acceptance list is verified.

## Reporting

End every session with: what you built, decisions made (with the tradeoff you saw), anything left open, and the exact commands/URLs to verify. Commit with conventional messages as you complete coherent chunks — never one giant commit.
