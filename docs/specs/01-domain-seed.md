# WP1 — Domain: full schema, repositories, seed

Read `AGENTS.md` first (binding contract). Prereq: WP0 is merged — scaffold, D1 + Drizzle + Effect pattern (`src/server/db.ts`, `runtime.ts`), `events` table exist. Extend those patterns; do not redesign them.

## Scope

Backend only. No routes/UI beyond what WP0 built. Deliver: Drizzle schema for the whole domain, migrations, `effect/Schema` domain models, repository services, and a seed command producing a believable demo conference. `docs/SCHEMA.md` is the reference data model — follow its tables/enums/relations and its design decisions (single `submissions` table with `kind`; statuses `draft|pending|maybe|accepted|declined|withdrawn`; `notified_at`; JSON `answers`; scheduling denormalized onto submissions). Where SCHEMA.md over-specifies beyond MVP (e.g. `saved views`), skip — the PRD's must-haves win. When in doubt: smallest schema that supports `docs/PRD.md` F1–F10.

## Tables (drizzle, one file per cluster is fine; keep it boring)

From `docs/SCHEMA.md`: `events` (extend WP0 table: type, website_url, location, theme, logo_url, background_url, default_submission_limit), `users`, `event_members` (+role), `reviewer_tracks`, `tracks` (+color), `tags`, `formats`, `levels`, `rooms`, `forms` (all builder fields incl. welcome/section/limits/notifications JSON columns where SCHEMA.md says jsonb), `form_fields` (incl. `condition` JSON, `maps_to`, `locked`, `position`), `contacts`, `submissions` (incl. `code` SESS-n, `kind`, `status`, `answers` JSON, `starts_at/ends_at/room_id`, `notified_at`), `submission_tracks`, `submission_tags`, `submission_participants`, `reviews`, `task_templates`, `task_assignments`, `portal_forms`, `portal_form_responses`, `file_requests`, `file_uploads`, `email_log`, `magic_link_tokens` (skip if better-auth will own auth tables — leave a one-line note instead; auth lands in WP2).

IDs: text (nanoid via drizzle `$defaultFn`). Timestamps: integer epoch ms with drizzle `mode: 'timestamp_ms'`. `created_at`/`updated_at` everywhere. FKs with sensible `onDelete`.

## Domain models + repos

- `src/server/schema/` — `effect/Schema` models per entity (status/kind as `Schema.Literal` unions). Decode drizzle rows at the repo boundary. Export TS types from schemas only.
- `src/server/repos/` — Effect services per aggregate (`Events`, `Forms`, `Submissions`, `Contacts`, `Reviews`, `Tasks`, `PortalForms`, `Files`, `EmailLog`). Methods only for what PRD F1–F10 needs (list/get/create/update/status-change/assign, submission code allocation `SESS-{n}` per event, review upsert per (submission, reviewer)). Typed failures: `NotFound`, `DbError` at minimum; add `SubmissionLimitReached`, `FormClosed` signatures where obvious (the enforcing logic can land with WP3).
- No service should exceed what a feature WP will call. When unsure, leave it out and note it.

## Seed (`pnpm seed`, idempotent — wipes and refills)

A believable conference; judges see this within seconds. **No lorem ipsum anywhere.** Content:

- Event: `AI.Engineer Sandbox — NYC 2026`, slug `ai-engineer-nyc-2026`, Oct 12–14 2026, `America/New_York`, theme text, limit 3.
- Tracks (color-coded): RAG & Retrieval, Agents, Evals & Observability, Infra & GPUs. Formats: Keynote, Featured Keynote, Talk, Workshop, Lightning. Levels: Intro, Intermediate, Advanced. Rooms: Main Stage, Hall A, Hall B, Workshop Studio. Tags: ~8 plausible (Open Models, Fine-tuning, Voice, Safety, Cost, Multimodal, DevTools, Production).
- Users: `demo@opensesh.io` (admin "Dana Organizer"), `reviewer@opensesh.io` ("Rey Reviewer", tracks: Agents + Evals).
- Contacts: ~26 speakers/submitters with realistic diverse names, titles/companies, emails at plausible domains; ~70% with bios (2–3 sentences, specific to their talk topic), ~60% with headshot_url (use `https://i.pravatar.cc/300?u={email}`), social links for some. Leave a few missing bio/headshot (dashboard insight fodder).
- Submissions: **32 total = 26 abstracts + 6 sessions** (sessions are sponsor-style, `kind='session'`, created directly as accepted). Abstract statuses: 11 pending, 4 maybe, 6 accepted, 2 declined (notified), 1 withdrawn, 2 draft. Realistic AI-conference titles + descriptions, written properly (e.g. "Evals that don't lie: grading agents in production", "RAG is dead, long live retrieval", "Shipping voice agents on a $200/mo budget"). 1–2 speakers each; tracks/tags/format/level set; sequential `SESS-n` codes.
- Reviews: Rey has reviewed ~6 submissions in their tracks (mix of approve/maybe/deny + scores + short specific comments); several pending ones un-reviewed (queue fodder).
- Task templates: "Hotel stay requirements" (contact-scope, linked portal form), "Flight reimbursement" (contact-scope, linked portal form), "Finalize talk description" (submission-scope), "Confirm bio & headshot" (contact-scope), all `auto_assign_on_accept`. Portal forms for hotel (check-in/out dates, room preference, special requests) and flight (airport, cost estimate, receipt upload note) with sections + fields.
- Task assignments: generated for accepted submissions' speakers — most complete for 2 speakers, partially done for others (portal + dashboard fodder).
- One submission form (matches the walkthrough video): internal "Session Submission Form", external "Welcome to our event!", welcome message rich text (call for speakers copy with the 4 tracks), abstract section (Title locked, Description, Format, Track, Tags required; Level optional), participant section (speaker role min 1 max 3; First/Last/Email locked; Mobile, Biography optional), close date Sep 15 2026, confirmation email ON with body.
- Schedule: ~8 of the accepted/session submissions placed across Oct 12–13 rooms/times; **exactly one deliberate conflict** (two sessions overlapping in Hall A ~30 min) — comment it in the seed source.
- Email log: 3–4 plausible historical entries (confirmations, one acceptance).

## Acceptance

1. `pnpm typecheck`, `pnpm build` clean; migrations generate + apply clean on a fresh local D1 (`pnpm db:migrate:local` from zero).
2. `pnpm seed` runs idempotently (twice in a row = same counts). Write a tiny `pnpm seed:verify` script asserting row counts per table and printing a summary table.
3. WP0 index route still renders.
4. No `throw`/`any`/`@ts-ignore` in `src/server/`; schemas are the only type source; repos decode rows through them.
5. Zero-debt self-review of the diff.

## Report

Table-by-table row counts, any SCHEMA.md deviations (with one-line rationale each), repo service surface (method list), open questions for WP2+.
