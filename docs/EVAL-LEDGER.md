# 100% eval score ledger

Companion to `docs/EVAL-100-PERCENT-SPEC.md` §8. One row per rubric item. Status: `done` (implemented + locally evidenced), `partial` (exists but missing a requirement), `todo`, `wp` (assigned to an in-flight WP). Update at every merge.

## CFP (18)

| ID | Status | Owner/notes |
|---|---|---|
| CFP-01 | partial | Builder has field types + required; verify blocked-invalid evidence path |
| CFP-02 | partial | Conditional fields exist (WP3); rehearse format/track condition |
| CFP-03 | done | Anonymous /submit URL with branding/deadline (WP3) |
| CFP-04 | partial | Close window enforced; verify closed-state copy + WP12 settings flip |
| CFP-05 | done | Wizard + drafts + confirmation + portal dashboard |
| CFP-06 | done | Round trip verified in walkthroughs |
| CFP-07 | done | Draft resume verified (cfp:verify) |
| CFP-08 | done | Confirmation email logged (mail templates); manual delivery pending |
| CFP-09 | done | Edit-while-open round trip |
| CFP-10 | wp16 | Reviewer provisioning w/ copyable access path |
| CFP-11 | wp16 | Rating+comment via new scorecard engine |
| CFP-12 | done | Accept/decline decisions persist |
| CFP-13 | done | Portal status chips |
| CFP-14 | done | Decision emails logged; manual delivery pending |
| CFP-15 | done | Same-row graduation (docs/SCHEMA.md decision 1) |
| CFP-16 | partial | Server-side close lock — audit direct mutation rejection |
| CFP-17 | done | Event switcher + create event (verified from scratch) |
| CFP-18 | partial | Event isolation — needs negative-path audit (WP15 seeds 2nd event) |

## Abstract Management (14)

| ID | Status | Owner/notes |
|---|---|---|
| ABS-01 | wp15+wp16 | Rounds schema (15) + UI (16) |
| ABS-02 | wp16 | Round-scoped pools |
| ABS-03 | wp16 | Scorecard builder + dynamic reviewer form |
| ABS-04 | wp15 | Weighted aggregate 3.33 unit-tested |
| ABS-05 | wp16 | Exact assignment scoping |
| ABS-06 | wp16 | Caps + auto-distribute + track bulk (all three) |
| ABS-07 | wp16 | Blind round identity suppression |
| ABS-08 | wp16 | Progress 0/2 → 2/2 |
| ABS-09 | wp16 | Reviewer reminders + log |
| ABS-10 | wp16 | Results sort asc/desc |
| ABS-11 | wp15+wp16 | Co-presenter role labels everywhere |
| ABS-12 | wp16 | Recusal + organizer status |
| ABS-13 | wp16 | CSV export of results |
| ABS-14 | wp16 | AI first-pass + attributed override |

## Speaker Management (16)

| ID | Status | Owner/notes |
|---|---|---|
| SPK-01 | partial | Roster + search exists; add workflow-status column/filter (wp17) |
| SPK-02 | wp17 | Manual Add/Edit Speaker full profile |
| SPK-03 | partial | CSV import exists; harden mapping/preview/dedupe counts (wp17) |
| SPK-04 | wp15+wp17 | Workflow status enum + badge + filter |
| SPK-05 | partial | Task templates exist; verify multi-speaker selection (wp17) |
| SPK-06 | wp17 | Portal invitation + copyable path + log |
| SPK-07 | done | Portal scoping verified; re-audit denial paths (wp17 audit) |
| SPK-08 | done | Profile round trip w/ approval pipeline |
| SPK-09 | done | Task check-off persists |
| SPK-10 | done | Headshot/file download metadata (WP14 spotlight) |
| SPK-11 | done | Sessions on both sides |
| SPK-12 | partial | Readiness board exists; explicit complete/incomplete filters (wp17) |
| SPK-13 | wp17 | Campaigns + per-recipient history |
| SPK-14 | wp17 | Merge tokens + resolved preview |
| SPK-15 | partial | contacts.custom exists; admin editor for logistics (wp17) |
| SPK-16 | wp17 | Reminder rules + Run now |

## Content Management (14)

| ID | Status | Owner/notes |
|---|---|---|
| CNT-01 | done | File requests w/ due dates, types, size |
| CNT-02 | done | Portal upload against task/session |
| CNT-03 | done | Scoping verified; re-audit (wp18) |
| CNT-04 | done | Versioning verified |
| CNT-05 | done | Comment threads cross-role |
| CNT-06 | partial | Constraints shown; verify server-side rejection evidence (wp18) |
| CNT-07 | done | Deliverables matrix + filters |
| CNT-08 | partial | Bulk reminders — verify count + logs (wp18) |
| CNT-09 | wp18 | Organizer edits session title/abstract centrally |
| CNT-10 | wp18 | Organizer edits speaker bio/headshot centrally |
| CNT-11 | partial | History+restore exists for speaker edits; organizer-authored entries + diffs (wp18) |
| CNT-12 | done | Approval gates public; direct-URL audit (wp18) |
| CNT-13 | wp18 | Central files library |
| CNT-14 | wp18 | Multi-select ZIP with grouping |

## AI Agenda (8)

| ID | Status | Owner/notes |
|---|---|---|
| AIA-01 | done | Multi-day builder |
| AIA-02 | done | Rooms/tracks CRUD in library; verify in-agenda add (integration) |
| AIA-03 | done | Placement persists |
| AIA-04 | done | Speaker conflict warnings |
| AIA-05 | done | Room overlap flagged |
| AIA-06 | done | Move clears conflicts |
| AIA-07 | done | Publish → public snapshot |
| AIA-08 | done | AI drafts + accept (verify one-action auto-schedule path) |

## Public Widgets (16)

| ID | Status | Owner/notes |
|---|---|---|
| EMB-01 | wp19 | Card enrichment (title/company on speakers, Show more) |
| EMB-02 | partial | Search exists; add speaker-name matching + count (wp19) |
| EMB-03 | partial | Facets exist; verify combine+clear (wp19) |
| EMB-04 | wp19 | Surname sort + fallbacks |
| EMB-05 | wp19 | Speaker detail w/ sessions meta |
| EMB-06 | done | Public agenda day/room structure |
| EMB-07 | done | Day switching |
| EMB-08 | partial | Session detail + back restoration (wp19) |
| EMB-09 | wp19 | Itinerary enrichment |
| EMB-10 | wp19 | My Schedule selection |
| EMB-11 | wp19 | Persistence + ICS export |
| EMB-12 | wp19 | Gallery surname sort + fallbacks |
| EMB-13 | wp19 | Gallery detail + restore |
| EMB-14 | done | All five views anonymous |
| EMB-15 | partial | Embed builder exists; field visibility + all five types (wp19) |
| EMB-16 | partial | Consistency; shared read model (wp19) |

## Speaker CRM (12, optional)

| ID | Status | Owner/notes |
|---|---|---|
| CRM-01..12 | wp15+wp20 | Schema (15) + full workspace (20) |

## Cross-cutting integration (mine, post-merge polish)

- [ ] §5.2 organizer nav labels: Overview, Call for Papers, Submissions, Evaluation, Speakers, Tasks, Deliverables, Sessions, Agenda, Files, Communications, Widgets, Speaker CRM, Event Settings
- [ ] Speaker nav: Home, My Submissions, My Sessions, Tasks, Profile; reviewer nav: My Reviews only
- [ ] Public header exposes Speaker Gallery
- [ ] §5.3: filled-state headings + record counts on every list; Clear filters; sort direction indicators
- [ ] §15 rules: text-labelled statuses, counts on bulk toasts, no hover-only controls, filters in URL params
- [ ] Step 12 scoping/negative-path audit
- [ ] Step 13 full 20-scenario local rehearsal
- [ ] Steps 14–15 deployed evaluator runs + manual-results.json
