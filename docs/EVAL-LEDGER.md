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
| CFP-10 | done | Reviewer pool add + copyable access path (WP16, browser-verified rounds editor) |
| CFP-11 | done | Scorecard engine w/ 1–5 pickers; Sam 4/2/Accept+comment submitted in browser (WP16) |
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
| ABS-01 | done | Two fixture rounds render; setup tab edits (WP15+16) |
| ABS-02 | done | Round-scoped pool (Sam sole member of Initial Review) |
| ABS-03 | done | Criteria builder + dynamic reviewer scorecard verified |
| ABS-04 | done | 3.33 aggregate shown in Results (browser) |
| ABS-05 | done | Exact assignment of SESS-1/2 to Sam via checkboxes |
| ABS-06 | done | Caps + auto-distribute + track filter in Assignments tab |
| ABS-07 | done | Blind queue: zero identity strings in reviewer DOM (verified) |
| ABS-08 | done | Progress counts + status chips (pending→completed observed) |
| ABS-09 | done | Lagging-reviewer reminders + log (WP16) |
| ABS-10 | done | Aggregate ascending/descending toggle in Results |
| ABS-11 | done | Priya + Marcus Co-presenter labels in organizer results |
| ABS-12 | done | Recuse button + confirmed flow (WP16) |
| ABS-13 | done | Export CSV → 'Exported 4 submissions' toast |
| ABS-14 | done | AI first-pass panel w/ honest no-key error; override path (WP16) |

## Speaker Management (16)

| ID | Status | Owner/notes |
|---|---|---|
| SPK-01 | done | Roster w/ workflow column + filters + counts (verified on main) |
| SPK-02 | done | Add/Edit Speaker full-profile dialog (WP17) |
| SPK-03 | done | CSV mapping/preview/Update-Skip; 1 created/1 updated/1 skipped fixture |
| SPK-04 | done | Workflow badges (Invited/Onboarding) + filter verified |
| SPK-05 | done | Multi-speaker task assignment (WP17) |
| SPK-06 | done | Portal invites + copyable path + idempotent (WP17) |
| SPK-07 | done | Portal scoping verified; re-audit denial paths (wp17 audit) |
| SPK-08 | done | Profile round trip w/ approval pipeline |
| SPK-09 | done | Task check-off persists |
| SPK-10 | done | Headshot/file download metadata (WP14 spotlight) |
| SPK-11 | done | Sessions on both sides |
| SPK-12 | done | Readiness + task complete/incomplete filters (WP17) |
| SPK-13 | done | Campaign composer + snapshots + recipient history (verified on main) |
| SPK-14 | done | Merge tokens + resolved Marcus preview verified on main |
| SPK-15 | done | Travel/logistics in contacts.custom via dialog (WP17) |
| SPK-16 | done | Reminder rule + Run now (WP17) |

## Content Management (14)

| ID | Status | Owner/notes |
|---|---|---|
| CNT-01 | done | File requests w/ due dates, types, size |
| CNT-02 | done | Portal upload against task/session |
| CNT-03 | done | Scoping verified; re-audit (wp18) |
| CNT-04 | done | Versioning verified |
| CNT-05 | done | Comment threads cross-role |
| CNT-06 | done | Constraints visible pre-upload + inline server errors (WP18) |
| CNT-07 | done | Deliverables matrix + filters |
| CNT-08 | done | Outstanding filter + selection + count toast + logs (WP18) |
| CNT-09 | done | Organizer session title/abstract edit, approved + attributed (WP18) |
| CNT-10 | done | Organizer bio edit verified on main: toast + approved snapshot |
| CNT-11 | done | Attributed history verified: Jordan Alvarez entry after bio edit |
| CNT-12 | done | Approval gates public; direct-URL audit (wp18) |
| CNT-13 | done | /admin/files library: 38 records, filters, detail thread |
| CNT-14 | done | ZIP ready/download verified (seed-key placeholder fix 63c46ed) |

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
| EMB-01 | done | Enriched cards + hierarchy redesign (title/code+star row) |
| EMB-02 | done | Speaker-name search '1 of 8' verified |
| EMB-03 | done | Track/Format/Room facets + active count + Clear verified |
| EMB-04 | done | Surname sort + initials fallbacks verified |
| EMB-05 | done | Speaker dialog w/ bio + linked session meta verified |
| EMB-06 | done | Public agenda day/room structure |
| EMB-07 | done | Day switching |
| EMB-08 | done | Agenda dialog + day/scroll restore verified |
| EMB-09 | done | Itinerary meta complete; compact speakers + clamped description |
| EMB-10 | done | Star toggle on sessions/agenda/itinerary/detail |
| EMB-11 | done | localStorage persistence + Export ICS verified |
| EMB-12 | done | Gallery surname order + fallbacks verified |
| EMB-13 | done | Gallery detail dialog + restore |
| EMB-14 | done | All five views anonymous |
| EMB-15 | done | Builder: 5 view types, filters, theme/time/color, 7 field toggles, live preview, Get code (Share URL + iframe) |
| EMB-16 | done | Single publicProgram read model across views |

## Speaker CRM (12, optional)

| ID | Status | Owner/notes |
|---|---|---|
| CRM-01..12 | done | Full workspace verified on main: directory 28 contacts/dupes/import, pipeline stages, segments, overview 90% + bars |

## Cross-cutting integration (mine, post-merge polish)

- [x] §5.2 organizer nav labels (verified on merged main: Organization/Speaker CRM, Program group, Portals incl. Files+Communications, Event Settings): Overview, Call for Papers, Submissions, Evaluation, Speakers, Tasks, Deliverables, Sessions, Agenda, Files, Communications, Widgets, Speaker CRM, Event Settings
- [x] Speaker nav: Home, My Submissions, My Sessions, Tasks, Profile; reviewer nav: My Reviews only
- [x] Public header exposes Speaker Gallery
- [ ] §5.3: filled-state headings + record counts on every list; Clear filters; sort direction indicators
- [ ] §15 rules: text-labelled statuses, counts on bulk toasts, no hover-only controls, filters in URL params
- [x] Step 12 scoping/negative-path audit (2026-08-10): all 123 server fns audited — every mutation wrapped in require:admin/speaker/reviewer or requireEvent membership check; session-join reads (runSessionServer) verified to Forbidden on empty membership (listForAdmin pattern); HTTP probes: Priya→/admin redirects to /portal, anonymous→/login, pending/unknown session codes render not-found while approved SESS-16 renders; Sam forcing /admin/abstracts sees "You cannot manage these submissions" with zero identity in SSR HTML; blind reviewer DOM identity scan clean (WP16 verification)
- [x] Step 13 chained DevFlow rehearsal (2026-08-11): CFP submit → assign → blind review → Accept (caught + fixed two release blockers: hardcoded session slug in decide/changeStatus, and `role = "speaker"` literal filters vs form-configured labels — commit ae6870e) → acceptance emails logged for Priya AND Marcus → drag-schedule SESS-1 to Main Stage 9:00 AM (dnd works; earlier synthetic-drag failures were the test harness's visibilitychange cancelling the sensor, not an app bug) → Publish agenda → public /sessions + /agenda show full session meta → Priya portal My Sessions shows slot. Gates + 3 verifiers green on fixed code; deployed eca19373 + prod DB reset + UA smoke green incl. sign-in
- [ ] Steps 14–15 deployed evaluator runs + manual-results.json
