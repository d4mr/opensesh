# WP19 — Evaluator-complete public views, personal schedule, ICS, widget builder depth

Read `docs/EVAL-100-PERCENT-SPEC.md` first — Step 10 of §9 and rubric items EMB-01…EMB-16 (§8.6) are authoritative. NO schema or migration changes.

## Scope

1. **Shared read model** (EMB-16): all five public views (Sessions, Speakers, Agenda, Itinerary, Gallery) + embeds consume ONE approved public-program read model (extend `packages/domain/src/server/repos/widgets.ts` `publicProgram`) so title/description/time/room/track/format/speakers are identical everywhere and source edits propagate without republishing embed configs. Sessions carry full speaker objects (name, title, company, headshot), format, track, room, full start/end.
2. **Sessions list** (EMB-01/02/03): cards show title, truncated description with **Show more** expansion, full date+time (event TZ), room, ALL speakers with title/company, format + track chips. Search matches title AND speaker name (case-insensitive) with a visible result count. Facets: Track, Format, Room — combining with intersection semantics, active-state display, **Clear filters**. Persist search/filters in URL params.
3. **Speakers list** (EMB-04/05): sorted by surname (last word of name), headshot with initials fallback, name, title, company (graceful when missing); name search; clicking opens a **speaker detail** (shared modal/panel component) with bio + their sessions each showing title/date/time/room; close restores list state.
4. **Agenda** (EMB-08): session click opens detail (full time range, room, description, format, track) and back/close restores the same day + scroll.
5. **Itinerary** (EMB-09/10/11): chronological within days; each row shows track, title, description, full date/time, room, complete speakers with title/company. **My Schedule**: star/add on itinerary (and agenda/session rows where natural); selection stored in event-scoped localStorage key; a "My Schedule" filter/view showing exactly the selected set; survives full reload; **Export ICS** downloads a valid calendar with one VEVENT per selected session (correct TZ conversion, unique UIDs — reuse/extend WP7 ICS generation). Anonymous — no login required.
6. **Speaker Gallery** (EMB-12/13): surname-ordered photo grid, name search, missing-photo/title fallbacks; card opens the SAME shared speaker-detail component; close restores grid + search state.
7. **Widget builder depth** (EMB-15): builder must generate share URL + iframe snippet for ALL FIVE widget types (sessions, speakers, gallery, agenda, itinerary); theme/color, content filters (track/format/day), and **field visibility toggles** (e.g. hide description, hide company) with a live preview; settings encoded in the generated URL/snippet so anonymous renders honor them.
8. **Nav**: public event header links all five views including Speaker Gallery.

## UI rules

`docs/DESIGN.md` binding. §15 of the eval spec: no login redirects on public links, counts on lists, no hover-only controls, don't hide evidence in collapsed sections by default (truncated descriptions with visible Show more are fine), avoid virtualizing small lists.

## Constraints (HARD)

- Branch `wp19-public-complete`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp19`, port 3019 only, stop server after. No schema/migration changes. Don't touch apps/landing or untracked files.
- `pnpm check`/`test`/`build` + three verifiers (fresh db:reset each) green. Add §11.4 unit tests: search matches title+speaker case-insensitively; filter intersection; personal-schedule serialization round trip; ICS one-VEVENT-per-selection with correct times + unique UIDs; read model identical across serializers.
- REPORT-WP19.md per §19 with rubric IDs satisfied.

## Acceptance (rehearse EMB-S1/S2/S3 traces from §7)

- Logged-out: all five views complete; search by title and by speaker narrows with counts; facets combine and clear.
- Speaker detail from List and Gallery shows bio + sessions w/ time/room; close restores state.
- My Schedule: select subset → exact list → reload persists → ICS downloads with only those events.
- Builder: five configured outputs render anonymously with theme/filter/field settings applied; a source content edit appears across every surface without touching embed configs.
