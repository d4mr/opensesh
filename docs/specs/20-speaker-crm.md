# WP20 — Organization-level Speaker CRM

Read `docs/EVAL-100-PERCENT-SPEC.md` first — Step 11 of §9 and rubric items CRM-01…CRM-12 (§8.7) are authoritative. WP15's CRM schema (`organization_contacts`, `organization_contact_events`, `organization_contact_notes`, `organization_tags`, `organization_contact_tags`, `crm_pipeline_stages`, `crm_pipeline_cards`, `crm_stage_history`, `crm_segments`) and repo skeletons are on main — extend them; NO schema or migration changes.

## Scope

1. **CRM shell** (`/admin/crm` or `/crm`): organization-level workspace OUTSIDE the event context (CRM-01) — reachable from the admin sidebar ("Speaker CRM" nav item) but clearly org-scoped (header shows organization, not event). Tabs/pages: Directory, Pipeline, Segments, Overview.
2. **Directory** (CRM-01/02/04): all organization contacts across events; search; filters for company, title, and tags combining with intersection + Clear filters; record count; row → contact detail.
3. **Contact detail** (CRM-03/04): canonical identity (name/email/title/company/bio/socials/headshot), editable tags + typed custom metadata, persistent internal notes (author + timestamp, newest first), linked events/sessions history (via organization_contact_events → event contacts → sessions), activity (notes + stage history + event additions, chronological).
4. **CSV import** (CRM-05): org-level import of `/private/tmp/killmysaas-evals/fixtures/speakers.csv` with header mapping, preview, dedupe by normalized email (Update/Skip), outcome counts.
5. **Duplicate detection + merge** (CRM-06): surface near-duplicate candidates (normalized name/email/company similarity); merge flow: pick primary, preview combined record, confirm (in-app confirmation); merge preserves ALL notes, tags, event links, and stage history; duplicate removed. Unit-test merge preservation (§11.5).
6. **Pipeline** (CRM-07/08): kanban board of configurable stages (open/won/lost semantics; stage CRUD w/ reorder); cards with contact + note; **Move to stage** via explicit action (dropdown/menu — drag optional); every transition recorded in `crm_stage_history` with actor + timestamp; card detail shows notes + transition history; persists across reload.
7. **Segments** (CRM-09): save current directory filters as a named segment (filter JSON); segments list; opening one re-applies filters and reproduces membership dynamically.
8. **Add to Event** (CRM-10): from contact detail/directory selection, pick an event → copies/links canonical profile into that event's contacts (dedupe by normalized email — link, don't duplicate); the event roster shows the speaker with profile data intact, no re-entry.
9. **Bulk email** (CRM-11): select directory contacts → compose with merge tokens (reuse the campaign engine from WP17 if merged; otherwise reuse `email_templates`/`email_campaigns` tables directly with a minimal composer) → per-recipient resolved preview → send (demo mail provider) → campaign + recipient history visible in CRM.
10. **Overview** (CRM-12): metric rail (total contacts, events reached, pipeline counts by semantic status, profile completeness %) + at least one populated visualization (simple bar/stacked list is fine — no chart dependency needed).

## UI rules

`docs/DESIGN.md` binding: dense rails, counts, text-labelled stages/statuses, Clear filters, confirmations on merge, no sheets, forms preserve values. CRM never references identity-plane users directly.

## Constraints (HARD)

- Branch `wp20-speaker-crm`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp20`, port 3020 only, stop server after. No schema/migration changes. Don't touch apps/landing or untracked files.
- `pnpm check`/`test`/`build` + three verifiers (fresh db:reset each) green. Add §11.5 unit tests (grouping, filter intersection + clear, ordered notes/history, duplicate surfacing, merge preservation, transition persistence, dynamic segment reproduction, add-to-event dedupe).
- REPORT-WP20.md per §19 with rubric IDs satisfied.

## Acceptance (rehearse CRM-S1/S2 traces from §7)

- Directory groups cross-event contacts; search + combined filters + clear work with counts.
- Priya detail: identity, note persists after reload, event/session history, tags, custom metadata.
- Near-duplicate Priya (different email) detected, merged to one canonical record with combined history.
- Pipeline: card moves through two stages, reload persists, detail shows timestamped attributed transitions.
- Add to Event lands Priya in DevFlow roster without re-entry or duplication.
- Bulk merge-tag email: resolved preview, send count, history.
- Overview metrics populated.
