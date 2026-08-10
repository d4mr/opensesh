# WP0b — Restructure: minimal monorepo + Vite+ toolchain

Follow-up to WP0 (which is merged and deployed — do not regress it). `AGENTS.md` has been updated since your scaffold; re-read it. Two changes landed there that this WP implements:

## 1. Minimal monorepo (per AGENTS.md "Monorepo (minimal)")

- pnpm workspace, exactly two packages:
  - **`apps/web`** — the TanStack Start app: everything currently at root except the domain pieces (routes, components, server-fns, styles, vite config, wrangler.jsonc, components.json).
  - **`packages/domain`** (`@opensesh/domain`) — move `src/db/` (drizzle schema, drizzle.config.ts, `migrations/`) and `src/server/` minus server-fns (errors, db service/query helper, events program, runtime). Package.json for domain: deps = `effect`, `drizzle-orm`, `@cloudflare/workers-types` (types only) — **no React, no TanStack, enforced here**. Note: `runtime.ts` imports `cloudflare:workers` env — keep the env access in web (pass the D1 binding into a domain layer factory) OR keep the `cloudflare:workers` import in domain if it stays types-clean on workerd; pick the simpler one that compiles, state the choice.
- `apps/web` imports domain only via `@opensesh/domain` (workspace protocol). No deep imports (`@opensesh/domain/src/...` banned — use package exports).
- wrangler paths (migrations_dir etc.) and drizzle config updated accordingly; `pnpm db:*`, `pnpm deploy` keep working from the **repo root** (root package.json orchestrates).
- Keep the git history clean: use `git mv` semantics where possible (you cannot run git — stage nothing; I commit. Just arrange the files and list old→new moves in your report).

## 2. Vite+ (per AGENTS.md "Commands — Vite+ toolchain")

- Install Vite+ (`curl -fsSL https://vite.plus | bash` — you have network; if the installer needs a persistent PATH, place the binary where pnpm scripts can reach it and document it).
- Root scripts: `dev` → `vp dev` (in apps/web), `build` → `vp build`, `check` → `vp check` (all packages via `vp run` if that's the idiom — follow viteplus.dev docs for monorepo usage), `test` → `vp test`, keep `deploy`, `db:*`, add `typecheck` alias to `check` for muscle memory.
- `vp check` must pass on the whole repo — fix any oxlint findings it raises in our code (not vendored/generated files; configure ignores for `routeTree.gen.ts`, `worker-configuration.d.ts`, migrations).
- If any `vp` command genuinely cannot work with the TanStack Start or Cloudflare plugin today, fall back per AGENTS.md (plain `vite`/`tsc`/`vitest` for that one script), and report exactly what failed with the error.

## Acceptance

1. `pnpm check && pnpm build` from root, clean.
2. `pnpm dev` serves the app; `/` still renders the seeded event locally.
3. `pnpm deploy` succeeds; https://opensesh.d4mr.workers.dev still renders the event (verify with curl, paste output).
4. `packages/domain/package.json` contains no react/tanstack deps; `grep -r "from \"react" packages/domain/src` empty; no deep imports of domain in apps/web.
5. Report: old→new file map, vp version + which commands run on vp vs fallback, any friction for future WPs (especially: how a WP adds a new domain module + migration + server fn in the new layout — write the 5-line recipe).
