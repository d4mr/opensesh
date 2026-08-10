# WP15 — Eval-sprint schema expansion + deterministic personas/fixtures

Read `docs/EVAL-100-PERCENT-SPEC.md` FIRST — sections 4 (fixtures), 6 (data model), and Steps 1–2 of section 9 are the authoritative requirements this WP implements. Read `AGENTS.md` and `docs/SCHEMA.md` for binding stack/tenancy/Effect rules. This WP is the foundation for five parallel WPs that follow; correctness and determinism matter more than UI (this WP ships NO new UI beyond what seeding requires).

## Scope

Two of the 15 sprint steps, exactly:

1. **Step 1 — complete schema expansion, applied once** (EVAL spec §6.1–6.4).
2. **Step 2 — deterministic evaluator personas and fixtures** (EVAL spec §4.1–4.6).

Out of scope: all UI for rounds/scorecards/campaigns/CRM (WP16–WP20 build those). Do not modify existing routes/components except where seeding or schema renames force a compile fix.

## Step 1 — schema (one flat migration)

Add ALL of the following tables/columns in one pass (names indicative; follow existing schema conventions in `packages/domain/src/server/schema/`):

### Review subsystem (§6.1)
- `review_rounds`: event_id, name, opens_at, closes_at, blind (bool), position, status.
- `review_criteria`: round_id, label, type (`numeric` | `dropdown` | `text`), min, max, options (jsonb), required, weight, position.
- `review_round_members`: round_id, event_member_id, assignment_cap (nullable).
- `review_assignments`: round_id, submission_id, event_member_id, status (`pending` | `completed` | `recused`), assigned_at, completed_at, recused_at, recusal_reason.
- `review_answers`: assignment_id, criterion_id, numeric_value, text_value, option_value.
- `ai_review_results`: round_id, submission_id, score, reasoning, provider, model, overridden_score, override_reason, overridden_by_event_member_id, created_at, overridden_at.

### Speaker + communications (§6.2)
- `contacts.workflow_status` enum: `invited` | `onboarding` | `confirmed` | `ready` | `declined` (default sensibly; existing seed contacts get statuses that tell a story).
- `email_templates`: event_id, name, subject_template, body_template, merge_fields (jsonb).
- `email_campaigns`: event_id, template_id (nullable), subject_snapshot, body_snapshot, recipient_filter (jsonb), status, created_by_event_member_id, sent_at.
- `email_campaign_recipients`: campaign_id, contact_id, resolved_subject, resolved_body, delivery_status, email_log_id (nullable FK).
- `reminder_rules`: event_id, task scope/type discriminator, days_before_due, enabled, last_run_at.

### Content (§6.3)
- Audit `submission_edit_history` / `contact_edit_history` for organizer-authored edits + restore; add ONLY missing snapshot fields (if any). No second versioning system.

### CRM subsystem (§6.4) — organization plane, NOT event plane
- `organization_contacts`: org-scoped canonical profile (name, email, title, company, bio, socials, headshot, custom jsonb).
- `organization_contact_events`: organization_contact_id, contact_id (event contact), event_id, role/status.
- `organization_contact_notes`: organization_contact_id, body, author (org member reference consistent with existing org tables), created_at.
- `organization_contact_tags` + `organization_tags` (org-scoped definitions).
- `crm_pipeline_stages`: organization_id, name, semantic_status (`open` | `won` | `lost`), position.
- `crm_pipeline_cards`: organization_contact_id, stage_id, owner, note, created_at, updated_at.
- `crm_stage_history`: card_id, from_stage_id (nullable), to_stage_id, actor, created_at.
- `crm_segments`: organization_id, name, filter (jsonb). Dynamic segments only — NO member table.
- CRM tables must never reference identity-plane user ids directly.

### Domain layer
- Effect Schema models + typed errors for: closed round, assignment cap exceeded, already recused, numeric out of bounds, dropdown value not in options, blind-data access, duplicate merge, invalid pipeline move.
- Repos: add `reviews.ts` and `crm.ts` repo skeletons with the READ models (list rounds w/ criteria, reviewer queue, progress, results w/ weighted aggregate; CRM directory, contact detail, pipeline board) and WRITE fns (save round/criteria, add member, assign, auto-distribute, submit answers, recuse, ai result + override; crm note/tag/segment/stage/move/merge/add-to-event, campaign create/send skeleton, reminder rule upsert + run). One DB round trip per public fn where feasible (follow WP2e conventions in existing repos).
- Weighted aggregate: sum(value × weight)/sum(weight) over numeric criteria — MUST return 3.33 (2dp) for Originality 4 (w2) + Relevance 2 (w1). Unit-test this exact case plus bounds/options rejection, cap enforcement, no-duplicate auto-distribution, blind read model excludes identity fields, recusal state change, AI override preserves original (EVAL spec §11.1).

### Migration rule (HARD)
Delete ALL of `packages/domain/migrations/`, run `pnpm run db:generate` exactly once → exactly ONE flat init migration. Then `pnpm run db:reset` against local `opensesh_wp15`.

## Step 2 — personas + fixtures (seed)

Extend `packages/domain/src/seed/seed.ts`. Keep the existing AI.Engineer Sandbox event fully intact (it is the second event proving CFP-17/18 isolation and hosts the demo-roles storytelling). Add:

### Event: DevFlow Conf 2027 (EVAL spec §4.1)
Name `DevFlow Conf 2027`, tagline `The developer workflow conference`, dates 2027-05-12 → 2027-05-14, location `Moscone West, San Francisco, CA`, timezone America/Los_Angeles. Tracks: AI Engineering; Platform & Infra; Developer Experience. Formats: Keynote 45; Talk 30; Lightning Talk 10; Workshop 120; Panel 45. Rooms: Main Stage; Room 2A; Room 2B; Workshop Lab.

### Accounts (§4.2) — password login MUST work for all four
| Jordan Alvarez | jordan.organizer@sbek-test.example.com | SbekTest!2027-org | organizer/admin of DevFlow |
| Priya Raman | priya.speaker@sbek-test.example.com | SbekTest!2027-spk | speaker |
| Marcus Okafor | marcus.speaker@sbek-test.example.com | SbekTest!2027-spk2 | speaker |
| Sam Whitfield | sam.reviewer@sbek-test.example.com | SbekTest!2027-rev | reviewer |

Use the same better-auth account-creation path the existing demo personas use. Jordan's default event = DevFlow. Priya/Marcus land in the DevFlow portal; Sam in reviewer shell scoped to DevFlow. Do NOT seed the `@example.com` placeholder aliases as separate contacts (no duplicate visible contacts) — skip aliases entirely.

### Speaker records (§4.3), submissions (§4.4), review fixtures (§4.5)
- Priya: Principal Engineer, Latticework Systems, fixture bio (build tooling/CI reliability/dev productivity), @priyabuilds, LinkedIn URL, vegetarian, T-shirt M.
- Marcus: Staff Developer Advocate, Cloudreach Labs, fixture bio (production AI agents, Agents Weekly, SF AI Tinkerers).
- Four submissions exactly as §4.4 (titles verbatim, tracks/formats/levels, Marcus co-presenter WITH visible role label on #1, notes fields populated). Statuses: leave all four `pending` (the evaluator decides/accepts during scenarios) with the CFP open (closes late 2026-11 so CFP-04 can flip it).
- Seed `review_rounds`: `Initial Review` (2026-08-01 → 2026-10-15, blind, criteria: Originality 1–5 w2, Relevance 1–5 w1, Recommendation dropdown [Accept/Maybe/Reject], Comments text) and `Final Review` (2026-10-16 → 2026-11-30, Final Score 1–10, Comments). Sam in Initial pool only. NO seeded assignments/answers (evaluator creates them).
- Seed one `email_templates` row (acceptance: subject `Your talk has been accepted to DevFlow Conf 2027`, body using `{speaker_name}` and `{talk_title}`), one disabled `reminder_rules` row (3 days before due), and default `crm_pipeline_stages` for the org (e.g. Prospect/Contacted/Confirmed = open,open,won + Declined = lost).
- CRM: create `organization_contacts` canonical rows for existing cross-event people + Priya/Marcus, linked via `organization_contact_events`.
- Idempotency principle for future flows: seed data must not block create-from-empty flows.

Update `packages/domain/src/seed/verify.ts` (or the existing seed-verification path) to assert the new tables' counts and the four personas.

## Constraints (HARD RULES)

- Branch `wp15-eval-foundation` in this worktree; NO commit, push, deploy, or remote/prod DB access.
- Local DB only: `opensesh_wp15` per `apps/web/.dev.vars` in this worktree.
- Dev server only on port 3015, stopped after use.
- Do not touch `apps/landing/` or untracked art/research files.
- No `any`, no thrown domain errors, no raw SQL in repos, no compatibility shims. Event-plane tables scope through event/member/contact/submission; org-plane through organization.
- `pnpm check`, `pnpm test`, `pnpm build`, `pnpm run db:reset`, `pnpm cfp:verify`, `pnpm review-desk:verify`, `pnpm mail:verify` must ALL pass (fresh `db:reset` before each verifier). Existing tests keep passing.
- Write `REPORT-WP15.md` (what built, decisions, verification evidence, open items, exact walkthrough commands).

## Acceptance

- Exactly one migration dir; db:reset green; all verifiers green.
- All four sbek personas log in with password and land in the right shell (verify via authenticated HTTP checks like prior WPs if no browser available).
- DevFlow event with exact tracks/formats/rooms; four fixture submissions visible in Jordan's abstracts desk; co-presenter label on #1.
- Both review rounds reload with full criteria via the new read model (verify by direct repo decode like WP14's report did).
- Unit tests cover §11.1 review-domain cases; weighted aggregate 3.33 test passes.
