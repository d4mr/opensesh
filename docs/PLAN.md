# opensesh.io — Implementation Plan

Greenroom theme. Effect v4. Cloudflare. Codex does the grunt work; Claude does architecture, specs, and taste. Deadline: **Wed Aug 12, 10 PM PT** (~3 days).

## Verified toolchain (checked, not assumed)

| Thing | Status |
|---|---|
| Codex CLI | `codex-cli 0.144.6`, default model `gpt-5.6-sol`, reasoning `high`. Non-interactive: `codex exec -C <dir> -s workspace-write "<prompt>"` |
| Emil Kowalski skills | `~/.agents/skills/`: `emil-design-eng` (philosophy, 674 lines), `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `pick-ui-library`, `prototype`, `apple-design` |
| Effect v4 | Vendored at `vendor/effect` pinned to tag `effect@4.0.0-beta.106` (repo main IS v4). npm dist-tag: `effect@beta`. Official agent skills in-repo are dev-tooling only; the real assets: `.patterns/`, `ai-docs/`, `LLMS.md`, package sources |
| Effect × Drizzle × D1 | `drizzle-orm@1.0.0-rc.4` exports `effect-d1` (+ `effect-postgres`, `effect-schema`) — official Effect integration over D1. better-auth ships a Drizzle adapter |
| Theme | `docs/themes/greenroom.css` — full shadcn variable set, light + dark, incl. status tokens |

## Architecture (decided)

- **TanStack everything** on one Cloudflare Worker: **TanStack Start** (framework) + **Router** (type-safe file routes) + **Query** (all server state) + **Table** (the Sessionboard-style lists: column picker, sort, filter) + **Form** (form builder + wizard, validated by Effect Schema via Standard Schema — verified: `Schema.standardSchemaV1` exists in v4).
- **SSR: off by default** (SPA mode) — admin and portal don't need it. Two exceptions where we expect to be "proven wrong," decided by measurement at WP8: public embeds and the CFP welcome page, where cold-load speed on third-party sites matters; Start supports per-route `ssr`, so flipping those two is a one-line change, not a rearchitecture.
- **Plain Workers + D1 + Drizzle.** No Durable Objects — the backend runs in the Worker; **D1** is the database, treated as a normal SQL DB so we can move later (D1 → Postgres = swap `drizzle-orm/effect-d1` → `drizzle-orm/effect-postgres`). **Drizzle owns schema + migrations** (`drizzle-kit generate` → `wrangler d1 migrations apply`). Verified: `drizzle-orm@1.0.0-rc.4` ships an official Effect integration incl. `effect-d1`. WP0 gates rc ↔ effect-v4-beta compatibility; fallback that changes nothing downstream: stable `drizzle-orm/d1` + a ~20-line `Effect.tryPromise` wrapper in the repo layer. `createServerFn` handlers run Effect programs via one runtime helper — auth check, decode, run, exhaustive error match.
- **Effect fully, not schemas-only** — the Rust-brain contract: every domain operation is an Effect program with **typed errors** (`Data.TaggedError`: `NotFound`, `Forbidden`, `FormClosed`, `SubmissionLimitReached`, `ScheduleConflict`…); services via `Effect.Service` + Layers; `Config` for env; `Schema.decodeUnknown` at every boundary (RPC input, form payload, DB row, API response — one schema, four uses). **No `throw`, no naked `Promise`, no `any`, no unchecked cast** in `src/server/`. Exhaustive `Match` on error channels maps each tagged error to its HTTP status + user-facing message. If it compiles, the unhappy paths are handled — that's the point.
- **UI**: shadcn/ui + Tailwind v4 + Greenroom tokens. Libraries per Emil's curated list, nothing else: `sonner` (toasts), `cmdk` (⌘K), `dnd-kit` (agenda), `motion` only where springs/exit animations are truly needed, `clsx`/`cva` (via shadcn). Everything else: CSS.
- **Email**: **Cloudflare Email Service via the Workers `send_email` binding** — no API keys, `env.EMAIL.send()`, and it compounds the "Cloudflare infra" bonus (swyx named both "cloudflare email or resend" as acceptable; neither carries its own bonus). Prereq: opensesh.io registered, on Cloudflare, `wrangler email sending enable opensesh.io`. `Mail` is an Effect service (~30 lines), so a Resend adapter is the drop-in fallback if domain onboarding hits friction. Always send `html` + `text`; `.ics` attachments from our own ~40-line builder (binding supports attachments). Every send recorded in `email_log` and viewable in-app.
- **Multi-tenancy**: row-level, minimal — `organizations` → `events` → everything else (already event-scoped). better-auth's `organization` plugin provides membership/roles logic over tables we own. One seeded org; no tenant UI for the competition — the data model + enforcement seam make SaaS-ification additive later. **Tenancy model on Postgres (decided): row-level, single schema.** At prod-declaration, add pg RLS policies (`org_id = current_setting('app.org_id')`, transaction-scoped set_config — pool-safe behind Hyperdrive) as defense-in-depth. Enterprise isolation tier when paid for = separate database per customer. Schema-per-tenant explicitly rejected: drizzle has no dynamic-schema story (factory-infected definitions or search_path session state on pooled connections) and drizzle-kit has no migration fan-out — permanent ops pain for the awkward middle ground. (D1-per-tenant previously rejected: hot-path HTTP API or Workers-for-Platforms machinery.)
- **Auth**: **better-auth** with the magic-link plugin (no passwords anywhere). Contacts (speakers) and admins in one flow, role from DB. Integration question owned by WP2 spec: better-auth's storage must reach the DO's SQLite — either better-auth runs inside the DO (auth routes forwarded from the worker) with an adapter over sqlite-do, or auth tables live in D1 (auth is not hot-path; both are acceptable, verified against better-auth docs before the spec is written). Demo mode: one-click role switcher exposing the magic links inline.

## Zero-debt policy (goes into AGENTS.md; codex reads it natively)

1. Minimum code that solves the problem. No speculative abstraction, no config nobody asked for, no error handling for impossible states. If 200 lines could be 50, rewrite. (Effect's own AGENTS.md preaches exactly this — we adopt their wording.)
2. `effect/Schema` types are the single source of truth; DB rows, TanStack Form validation, RPC payloads, and API responses all derive from the same schema.
3. Backend correctness is type-driven: typed error channels end-to-end, exhaustive `Match` at the boundary, no `throw`/naked promises/`any`/`@ts-ignore`/unchecked casts in `src/server/`. No TODO comments — a TODO is either a spec item or deleted.
4. Every WP lands green: `tsc --noEmit`, lint, and the walkthrough steps it owns pass in the browser.
5. Motion follows the Emil doctrine (below). No `transition: all`, no `ease-in`, nothing >300ms, no animation on keyboard-initiated actions.

## Motion & design doctrine (distilled for every UI spec)

- Custom curves declared once in CSS: `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`.
- Durations: press feedback 100–160ms · popovers 125–200ms · dropdowns 150–250ms · modals/drawers 200–300ms.
- `:active { transform: scale(0.97) }` on every pressable. Enter states via `@starting-style`. Popovers scale from trigger origin; never from `scale(0)` — start at 0.95 + opacity.
- CSS transitions over keyframes (interruptible). `transform`/`opacity` only. Hover states gated behind `@media (hover: hover)`. `prefers-reduced-motion` respected.
- List entries (table rows on filter, toasts, task check-off) may stagger 30–50ms. Frequent actions (tab switches, ⌘K) animate minimally or not at all.
- Greenroom personality: calm, hospitable, crisp — no bounce in admin; a touch of spring allowed on portal task completion and drag-drop settle (the two "delight" moments).

## Work packages

Serial spine first, then parallel tracks. Each WP = one spec file (`docs/specs/NN-name.md`) I write, one codex session, one review gate.

| WP | Scope | Depends on |
|---|---|---|
| **0. Scaffold** | TanStack Start on CF Workers, Tailwind v4 + greenroom.css wired, shadcn init (real CLI components), Effect v4 + drizzle rc deps, **the critical spike**: D1 + drizzle migration + Effect repo → server fn → TanStack Query render, deployed to workers.dev. Deploy script. *Decision gate: `effect-d1` rc ↔ effect v4 compat (fallback: stable `drizzle-orm/d1` + thin Effect wrapper).* | — |
| **1. Domain + seed** | Full schema from SCHEMA.md as `effect/Schema` models + SQL migrations + repositories. Seed script: the believable AI conference (~30 submissions across statuses, tracks RAG/Agents/Evals/Infra, speakers with bios/headshots, hotel+flight task templates, partial agenda with one conflict). | 0 |
| **2. Auth + shells** | better-auth + magic-link plugin (storage decision spiked first), cookie sessions, admin shell (sidebar/topbar/⌘K), portal shell, public layout, demo role-switcher. | 1 |
| **3. CFP** | Admin form builder (setup → welcome → questions → participants → settings → notifications, conditional logic, close date, limits) + public 5-step wizard — both on TanStack Form with Effect Schema validators (drafts, validation, confirmation + success page + redirect). | 2 |
| **4. Review desk** | Abstracts list on TanStack Table (status tabs, filters, column picker, inline status edit, CSV export, detail view), reviewer queue by track, approve/maybe/deny + score + comment, **accept side-effects** (speaker confirm, task auto-assign, decision email w/ feedback, notified_at). | 2 |
| **5. Portal** | Speaker home/submissions/profile/tasks, portal forms (hotel/flight), file uploads (R2), task check-off, admin task board + readiness view. | 2 |
| **6. Agenda** | Day + rooms grid, dnd-kit drag/drop/resize, live conflict detection (room overlap, speaker double-book), conflicts list, unscheduled pool. | 2 |
| **7. Mail + ICS** | Cloudflare Email `send_email` binding (Resend adapter as fallback), templates (confirmation, magic link, decision, task reminder), ICS builder + calendar invite on scheduling, email log + in-app viewer. | 1 (parallel w/ 3–6; 4/5 consume it) |
| **8. Public + API** | Embeds: agenda, speaker gallery, session list (fast, mobile, iframe snippet) + `GET /api/v1/{sessions,speakers,events}` (token, paginated, Sessionboard-shaped) + tiny demo consumer page ("this could power ai.engineer"). | 4, 6 |
| **9. Dashboard + agent** | KPI cards, "needs attention" insights, recent submissions; review-copilot (summarize, near-dupes, draft decision email). **First cut candidate.** | 4 |
| **10. Hardening** | Feature freeze. Full walkthrough ×5 (desktop/mobile/incognito/cold). Emil `review-animations` pass + my taste pass. Speed audit. README with walkthrough map. Stretch: Sessionboard CSV import. | all |

Parallelism: after WP2 lands, WP3–7 run as **up to three concurrent codex sessions in git worktrees** (3/4 share form-rendering surface — sequence those two; 5, 6, 7 are cleanly separable).

## Delegation protocol

1. I write the spec: exact scope, files to touch, schema slices, acceptance checklist, relevant Emil skill paths + `vendor/effect` pointers pasted in.
2. Launch: `codex exec -C <worktree> -s workspace-write --add-dir vendor/effect "$(cat docs/specs/NN-name.md)"` (background, monitored).
3. Review gate (me): diff read for debt (abstractions, deps, dead code), `tsc` + lint, browser walkthrough of the WP's acceptance list, motion check against the doctrine. Small fixes I make directly; anything structural goes back to codex with a written correction — same session via `codex exec resume`.
4. Subagent lookups: questions about Effect v4 idioms get answered from `vendor/effect` source/`.patterns`/`ai-docs` by Explore agents, never from memory (v4 ≠ v3 and training data).

## Timeline

- **Today (Aug 10)**: WP0 + WP1 + WP2 + specs for 3–7.
- **Aug 11**: WP3–7 in parallel waves; WP8 evening.
- **Aug 12 (deadline day)**: WP9 morning if green; **freeze by noon PT**; WP10 hardening; submit with hours to spare.

Cut order if behind: 9 → Sessionboard import → 8's demo page → dashboard insights. Never cut: the core loop, seed quality, speed, email/ICS.
