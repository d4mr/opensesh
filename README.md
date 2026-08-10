# opensesh

Open-source event program management — a full rebuild of Sessionboard's Program module for swyx's [Kill My SaaS](https://forge.smol.ai/swyx/killmysaas) challenge. CFP → review → speaker onboarding → content approval → agenda → public widgets, as one connected workflow.

**Live demo:** https://opensesh.d4mr.workers.dev

## Try it in 30 seconds

Every page has a **Demo roles** button (bottom right) — one click signs you in as any persona, no credentials needed:

| Persona | Role | What to look at |
|---|---|---|
| Dana Organizer | Admin | Dashboard, review desk, content approval, tasks |
| Rey Reviewer | Reviewer | Evaluation queue (scoped to their tracks only) |
| Maya Chen | Speaker | Portal: edit an accepted talk → lands in Dana's approval queue |
| Lina Haddad | Speaker | Portal task checklist mid-flight |
| Jamal Reed | Speaker | Missing bio — watch the readiness board notice |

Email+password sign-in also works for every persona (password is seeded for the demo: `demo-pass-2027`).

## The guided tour (rubric-mapped)

1. **CFP** — public wizard at [/submit/aie-nyc-2026/frm_cfp_aie_nyc](https://opensesh.d4mr.workers.dev/submit/aie-nyc-2026/frm_cfp_aie_nyc): multi-step Linear-style flow, drafts with resume, conditional questions, submission limits, co-presenters. Organizer side: form builder, event creation, tracks/formats/rooms library CRUD under **Forms** and **Settings**.
2. **Abstract management** — **Abstracts** desk: status tabs, track/format/tag filters, column control, CSV export, bulk decisions; detail page with decision panel, review roll-up, activity, email history.
3. **Evaluation** — **Evaluation**: reviewer queue with keyboard-first scoring (rating + comment + decision), scoped per reviewer.
4. **Speaker management** — **Speakers** directory; **Tasks**: templates with auto-assign-on-accept + a live readiness board (dietary/t-shirt, outstanding counts, waive/remind).
5. **Content management** — **Content**: pending-change approval queue with field-level diffs, per-session speakers + versioned history with restore; **Portal Forms** (structured onboarding forms + responses + CSV); **File Requests** (versioned uploads with cross-role comment threads). Speaker edits to accepted sessions require organizer approval before they go public — the last approved version stays live.
6. **Agenda** — day/room schedule builder with drag-and-drop, conflict detection, and an explicit draft → publish step. *(landing shortly — WP6)*
7. **AI agenda** — criteria → generate → compare → accept-per-change drafts; never touches the live agenda until you commit. *(WP9)*
8. **Public widgets** — five embeddable views (sessions, speakers, gallery, agenda, itinerary) + an organizer embed builder with live preview and copyable iframe code. Live data — no 60-minute cache. *(WP8)*
9. **Emails** — real transactional email (acceptance/decline with merge fields, task reminders, calendar invites with ICS) + an in-app email viewer so you can verify sends without an inbox. *(WP7)*

## Stack

- **App**: TanStack Start (full SSR) on Cloudflare Workers; TanStack Router/Query/Table
- **Data**: PlanetScale Postgres via Hyperdrive; Drizzle ORM; Effect for the domain layer (one DB round-trip per server function)
- **Files**: Cloudflare R2 (versioned uploads)
- **UI**: shadcn/ui (new-york-v4), Manrope, TipTap editor; design language documented in [docs/DESIGN.md](docs/DESIGN.md)
- **Monorepo**: `apps/web` (product) · `apps/landing` (marketing) · `packages/domain` (schema, repos, seed)

## Local development

```bash
docker run -d --name opensesh-pg -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:17
pnpm install
# apps/web/.dev.vars: DATABASE_URL + BETTER_AUTH_SECRET
pnpm run db:reset   # migrate + seed + verify
pnpm dev            # http://localhost:3000
```

`pnpm check` runs formatting, lint, and typechecks across the workspace. Integration verifiers: `pnpm run cfp:verify`, `pnpm run review-desk:verify` (note: they mutate seed state — run `db:reset` after).

## Docs

- [docs/PRD.md](docs/PRD.md) — product scope · [docs/SCHEMA.md](docs/SCHEMA.md) — data model
- [docs/DESIGN.md](docs/DESIGN.md) — the UI taste reference every surface follows
- [docs/specs/](docs/specs/) — work-package specs · [research/sessionboard/gap-analysis.md](research/sessionboard/gap-analysis.md) — parity analysis
