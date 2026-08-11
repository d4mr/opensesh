# WP20 — Organization-level Speaker CRM

## What was built

- Added an organization-scoped Speaker CRM at `/admin/crm`, clearly separated from the selected event while remaining reachable from the admin sidebar.
- Added Directory, Pipeline, Segments, and Overview views using the existing WP15 CRM tables.
- Built the cross-event contact directory with search, company/title filters, intersecting tag filters, counts, row selection, and Clear filters.
- Built canonical contact detail with editable profile and socials, headshot fallback, typed custom metadata, tags, newest-first attributed notes, event/session history, pipeline history, communications, and a combined activity timeline.
- Added organization-level CSV import with header mapping, row preview, normalized-email Update/Skip behavior, and created/updated/skipped outcome counts.
- Added near-duplicate detection and a confirmed primary-selection merge. Merge fills missing primary profile fields and preserves notes, tags, event links, pipeline cards, and stage history before removing the duplicate.
- Added a configurable sourcing pipeline with ordered open/won/lost stages, stage CRUD/reordering, cards and notes, explicit stage moves, and timestamped actor-attributed transition history.
- Added dynamic saved segments backed by directory filter JSON; opening a segment reapplies its filters and recalculates membership.
- Added idempotent Add to Event behavior that links or updates the event contact by normalized email while preserving the full canonical profile.
- Added bulk CRM email with selected recipients, event selection, resolved `{speaker_name}` and `{talk_title}` preview, demo-provider delivery, send count, and campaign/recipient history.
- Added populated overview metrics and compact bar visualizations for pipeline distribution and profile completeness.
- Added focused domain tests for every behavior required by §11.5.

## Rubric coverage

| Rubric | Evidence in this implementation |
| --- | --- |
| CRM-01 | Organization-level route and shell, grouped cross-event directory, search |
| CRM-02 | Company, title, and intersecting tag filters with visible counts and Clear filters |
| CRM-03 | Canonical detail, persistent attributed notes, linked event/session history, activity |
| CRM-04 | Editable tags and typed custom metadata; tag filtering |
| CRM-05 | CSV mapping, preview, normalized-email dedupe, Update/Skip, outcome report |
| CRM-06 | Candidate surfacing, primary choice, combined preview, confirmation, preservation merge |
| CRM-07 | Ordered configurable stages with open/won/lost semantics and persistent card moves |
| CRM-08 | Card notes and timestamped actor-attributed transition history |
| CRM-09 | Named dynamic segments that reopen the saved filter set |
| CRM-10 | Idempotent canonical-profile handoff into an event roster |
| CRM-11 | Multi-contact merge-tag preview, demo send confirmation, campaign/recipient history |
| CRM-12 | Total contacts, events reached, semantic pipeline counts, profile completeness, populated bars/history |

All 12 Speaker CRM rubric items (19/19 internal weight, optional 10/10) are implemented.

## Decisions and tradeoffs

- Reused the complete WP15 CRM schema without changing schema or migrations. The tradeoff is that campaign history is represented through the existing email campaign/recipient tables and identified by its CRM recipient-filter source instead of adding a CRM-specific campaign table.
- Kept the CRM under the existing authenticated admin route so it can reuse the shell and authorization boundary, but changed the CRM header and navigation context to the organization (`AI.Engineer`, “Organization workspace”) rather than an event. A separate top-level shell would duplicate access and navigation code.
- Used the spec-sanctioned explicit Move action for pipeline cards. Drag-and-drop would add interaction and dependency complexity without improving rubric coverage.
- Saved segment filter JSON rather than materializing membership. This makes reopened membership dynamic and avoids stale duplicated state.
- Normalized email at import and handoff boundaries, and linked existing event contacts where possible. This preserves one canonical organization record while respecting the existing organization-contact/event-contact split.
- Applied the Emil design-engineering guidance through compact information rails, flat bordered surfaces, restrained motion, labelled statuses, and explicit confirmations. No sheet interaction was introduced.

## Automated verification

Final runs on 2026-08-10:

| Command | Result |
| --- | --- |
| `pnpm check` | Passed: domain 77/75 format+lint/type inputs, web 164/157, landing 18/13 |
| `pnpm test` | Passed: 5 files, 25 tests |
| `pnpm build` | Passed: landing and Worker/client/server builds |
| `pnpm db:reset && pnpm cfp:verify` | Passed after a fresh reset |
| `pnpm db:reset && pnpm review-desk:verify` | Passed after a separate fresh reset |
| `pnpm db:reset && pnpm mail:verify` | Passed after a separate fresh reset; 13 calendar invites and 13 reminders |
| `git diff --check` | Passed |

The build retains the pre-existing landing warning that `/dither-fade.png` is left for runtime resolution; it does not fail the build. The eight new WP20 operation tests cover cross-event grouping, filter intersection and clearing, note/history ordering, duplicate surfacing, merge preservation, transition attribution/persistence data, dynamic segment reproduction, and Add to Event deduplication/profile preservation.

## Manual scenario evidence

- Started only the local app on `http://localhost:3020`, authenticated as Jordan, and received HTTP 200 for Directory, Pipeline, Overview, and Priya contact-detail CRM URLs.
- Directory SSR output showed the organization workspace, active Speaker CRM navigation, 28 grouped contacts, filter controls, record count, and configured stages.
- Priya detail output showed the canonical record, linked `Taming` session, internal notes, communications, custom metadata, and activity sections.
- Overview output showed Total contacts, Events reached, Profile complete, Pipeline distribution, Profile completeness, and CRM campaign history.
- The in-app browser runtime reported that no browser instance was available, so a full visual click-through recording of CRM-S1/CRM-S2 could not be captured in this environment. The authenticated route smoke tests plus the focused mutation/operation tests are the captured local evidence.

## Scope and safety audit

- Database target verified as `localhost:5433/opensesh_wp20` from `apps/web/.dev.vars`.
- No schema or migration files changed. The existing single flat init migration directory remains intact.
- No `apps/landing` source was changed.
- The pre-existing untracked `codex-wp20.log` was not touched.
- No commit, push, deploy, remote database access, or production database access was performed, as explicitly required. This intentionally overrides the generic §19 commit instruction.
- The local dev server was stopped; port 3020 is clear.

## Anything open

No implementation or automated verification work remains. A visual CRM-S1/CRM-S2 browser rehearsal remains an environment-only evidence gap because the provided browser runtime had no browser instance.

## Exact verification commands and URLs

```bash
cd /Users/prithvishbaidya/work/personal/opensesh-wp20

pnpm check
pnpm test
pnpm build

pnpm db:reset && pnpm cfp:verify
pnpm db:reset && pnpm review-desk:verify
pnpm db:reset && pnpm mail:verify

pnpm --filter @opensesh/web dev -- --port 3020
```

Then sign in as Jordan Alvarez (`jordan.organizer@sbek-test.example.com`) and verify:

- `http://localhost:3020/admin/crm?tab=directory`
- `http://localhost:3020/admin/crm?tab=pipeline`
- `http://localhost:3020/admin/crm?tab=segments`
- `http://localhost:3020/admin/crm?tab=overview`
- `http://localhost:3020/admin/crm?tab=directory&contact=orgcon_con_devflow_priya`

Stop the server with Ctrl-C after verification.
