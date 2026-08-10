# WP19 — Evaluator-complete public views

## What was built

- Completed all five anonymous public program views on the shared approved `Widgets.publicProgram` read model.
- Enriched Sessions with title/speaker search, result counts, URL-backed state, intersecting Track/Format/Room facets, active filters, clear filters, complete session/speaker metadata, and Show more/Show less descriptions.
- Added surname-ordered, searchable Speaker List and Speaker Gallery views with robust image/title/company fallbacks and one shared speaker-detail dialog. The dialog shows bio and every linked session with its date, time, and room.
- Changed public Agenda session opening to an in-place detail dialog. The selected day and underlying scroll position remain intact on close.
- Completed Itinerary metadata and added an anonymous event-scoped My Schedule. Stars are available on natural session/agenda/itinerary/detail surfaces, selection survives reload through localStorage, and My Schedule filters to the exact selected identifiers.
- Added a standards-compliant multi-event ICS export with one unique-UID VEVENT per selected session and UTC event times derived from the published instants.
- Expanded Widget Builder output for Sessions, Speaker List, Speaker Gallery, Agenda, and Itinerary. It now exposes track/format/day filters, theme, primary color, time format, field visibility, live preview, an anonymous share URL, and an iframe snippet. Every setting is encoded in the output URL.
- Added browser-safe public-program utilities and the §11.4 automated coverage for search, filter intersection, localStorage serialization, ICS event count/times/UIDs, and cross-view metadata identity.

## Rubric coverage

Implemented: **EMB-01, EMB-02, EMB-03, EMB-04, EMB-05, EMB-06, EMB-07, EMB-08, EMB-09, EMB-10, EMB-11, EMB-12, EMB-13, EMB-14, EMB-15, EMB-16**.

## Decisions and tradeoffs

- Kept `publicProgram` as the single database-backed public read model. View serializers and renderers derive from its `PublicSession` objects instead of introducing per-view queries. This keeps organizer source edits live everywhere without republishing widget records.
- Used shared, centered shadcn dialogs for speaker and agenda details. A separate detail route would have made direct linking easier, but would have required reconstructing day, filters, modal origin, and scroll state on return.
- Stored personal schedules under `opensesh-my-schedule:<event-id>`. An authenticated server schedule would support cross-device sync, but anonymous event-scoped localStorage is the smallest implementation required by EMB-10/11.
- Exported UTC DTSTART/DTEND values while retaining `X-WR-TIMEZONE`. Published schedule timestamps are already absolute instants, so UTC avoids ambiguous daylight-saving conversions while calendar clients display the correct event-local times.
- Kept day filtering in the generated URL and preview instead of extending persisted widget options. This obeys WP19's no-schema rule; the copied URL remains the complete immutable configuration. The rejected alternative was adding `dayKeys` to the widget options schema.
- Applied restrained design-engineering guidance: visible press feedback, short existing dialog transitions, no hover-only actions, and no decorative motion added to high-frequency controls.

## Schema, migrations, and protected scope

- No database schema changes.
- No migration changes; the existing single init migration checksums remain unchanged.
- No changes under `apps/landing`.
- The pre-existing untracked `codex-wp19.log` was not touched.
- No commit, push, deploy, remote database access, or production database access was performed, per the WP19 hard rules. This intentionally overrides the generic reporting contract's commit step.

## Automated verification

- `pnpm check` — passed across landing, domain, and web; no format, lint, or type errors.
- `pnpm test` — passed: 5 files, 22 tests.
- `pnpm build` — passed for landing and the Cloudflare Worker web app.
- Fresh `pnpm run db:reset && pnpm run cfp:verify` — passed all 13 CFP integration checks.
- Fresh `pnpm run db:reset && pnpm run review-desk:verify` — passed all 13 review-desk checks.
- Fresh `pnpm run db:reset && pnpm run mail:verify` — passed failure isolation and all 10 mail/calendar checks.
- `git diff --check` — passed.
- Migration checksums after implementation:
  - `migration.sql`: `cffa40241d0aec0e5f2599a259195f884d5ee915`
  - `snapshot.json`: `b77ead3a49cd8a4747398d0ee62a82ee44c469a0`

## Manual and HTTP evidence

The local server was started only on port 3019. Anonymous HTTP smoke returned 200 with filled rendered responses for:

- `/e/ai-engineer-nyc-2026/sessions` — 47,763 bytes
- `/e/ai-engineer-nyc-2026/speakers` — 25,362 bytes
- `/e/ai-engineer-nyc-2026/agenda` — 27,706 bytes
- `/e/ai-engineer-nyc-2026/itinerary` — 38,113 bytes
- `/e/ai-engineer-nyc-2026/speakers/gallery` — 26,448 bytes
- Encoded anonymous Sessions embed — 200, 25,400 bytes

Port 3019 was stopped afterward and verified to have no listener.

## Open verification evidence

No in-app or external browser instance was connected to this session. Therefore the interactive EMB-S1/S2/S3 click/reload/download rehearsal and screenshots were not captured; only automated tests, verifier output, build output, and anonymous HTTP rendering were verified. The implementation path is complete, but the manual evaluator evidence should still be captured in a connected browser before assigning manual EMB-11/15/16 verdicts.

## Exact verification commands

```bash
cd /Users/prithvishbaidya/work/personal/opensesh-wp19

pnpm check
pnpm test
pnpm build

pnpm run db:reset && pnpm run cfp:verify
pnpm run db:reset && pnpm run review-desk:verify
pnpm run db:reset && pnpm run mail:verify

pnpm --filter @opensesh/web dev -- --port 3019
# Stop with Ctrl-C when verification is complete.
```

## Exact local URLs

- `http://localhost:3019/e/ai-engineer-nyc-2026/sessions`
- `http://localhost:3019/e/ai-engineer-nyc-2026/speakers`
- `http://localhost:3019/e/ai-engineer-nyc-2026/agenda`
- `http://localhost:3019/e/ai-engineer-nyc-2026/itinerary`
- `http://localhost:3019/e/ai-engineer-nyc-2026/speakers/gallery`
- `http://localhost:3019/admin/widgets`
- `http://localhost:3019/embed/emb_agenda_dark?view=sessions&theme=light&color=default&time=24h&tracks=&formats=&days=&tags=&company=0&title=1&bio=1&description=0&level=1&format=1&calendar=1`
