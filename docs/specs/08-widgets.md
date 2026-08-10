# WP8 — Public pages, five embeddable widgets, embed builder, speaker CSV

Read `AGENTS.md` first. Prereqs: WP5 (approved content snapshots) + WP6 (published agenda snapshot) + WP7 (ics.ts) merged. References: `docs/SCHEMA.md` §embeds; `research/sessionboard/gap-analysis.md` P0 #5 (five widget types are a hard requirement — Public Widgets = 20% of the rubric); `docs/EVAL-PRIORITIES.md` (CSV speaker import fixture).

**Publishing rules (non-negotiable):** public surfaces render ONLY (a) the last **published** agenda snapshot from WP6 — never the live draft — and (b) **approved** session/speaker content from WP5 (`approvedSnapshot` / approved edit history). An unapproved speaker edit must not leak to any public page or widget. Round-trip integrity is a standing eval rule.

## A — Public event site `/e/{slug}`

Upgrade the existing public event page into a small site with a shared minimal frame (event name, dates, nav pills — reuse the portal pill nav pattern from `docs/DESIGN.md`, no auth):

1. `/e/{slug}/sessions` — **List of Sessions**: catalog-first list; search + track/format filter chips; each row: title, speakers, track chip (track color), format, level. Row → session detail (dialog or `/e/{slug}/sessions/{code}`): description (rich text), speakers w/ bios, time+room when published, add-to-calendar (ICS download via WP7 `ics.ts`).
2. `/e/{slug}/speakers` — **List of Speakers**: compact rows (headshot, name, title/company, session links).
3. `/e/{slug}/speakers/gallery` — **Speaker Gallery**: visual card grid (headshot-forward, hover reveals sessions). Shares the speakers query; differs only in presentation.
4. `/e/{slug}/agenda` — **Agenda**: date/time-separated schedule — day switcher, time-grouped rows across rooms, track color edges.
5. `/e/{slug}/itinerary` — **Schedule Itinerary**: chronological single-column itinerary (time → session cards), printable-clean.

Empty states matter (agenda unpublished → "The agenda hasn't been published yet", zero speakers etc.). 1-DB-wave rule per route. Dark/light per system.

## B — `embeds` table + embed rendering

Schema (flat migration regen per AGENTS.md): `embeds` — id, event_id FK, name, view enum(`sessions`,`speakers`,`speaker_gallery`,`agenda`,`itinerary`), enabled bool, options jsonb, timestamps. Options (typed schema, all optional with defaults): track/format/tag filters, theme (`light`/`dark`/`auto`), primaryColor, dateFormat (`12h`/`24h`), field visibility flags (per view: speaker company/title/bio, session description/level/format), showAddToCalendar bool.

`/embed/{embedId}` renders the configured view standalone: no site frame, transparent-page-friendly, honors options, `X-Frame-Options` NOT set (must be iframable), respects `?theme=` override. Disabled embed → minimal "embed disabled" note.

## C — Embed builder `/admin/widgets`

Admin nav item **Widgets** (Program group, after Agenda). List of named embeds (rows: name, view badge, enabled switch, updated). "Add widget" + row click → **editor as a two-pane surface**: left = form (name, view select, filters, theme, primary color, date format, field visibility checkboxes, add-to-calendar toggle), right = **live preview** (iframe of `/embed/{id}` re-keyed on change, debounced). Footer: **Get code** — copyable `<iframe src=".../embed/{id}" …>` snippet (copy button + sync whisper "Copied"). Live data, no cache delay (improvement over Sessionboard's 60-min cache — mention in README).

## D — Speaker CSV import/export (CRM extra credit, build fully)

On `/admin/speakers`: **Import CSV** (accepts the eval `speakers.csv` fixture shape — headers like first_name,last_name,email,title,company,bio,dietary,tshirt,linkedin,twitter…; tolerate header-case/order variance): upload → parsed preview table (first 5 rows, column mapping auto-detected, per-row validation errors) → import; dedupe by email within event (update, don't duplicate). **Export CSV** of the directory (same columns). Directory rows already exist — ensure dietary/t-shirt/social fields display.

## Acceptance

1. `pnpm check && pnpm build && pnpm test` green; seed green.
2. Walkthrough: publish agenda in WP6 UI → all five public views render seeded data; make a speaker edit in the portal (pending approval) → public pages still show the approved version; approve → public updates. Create two embeds (dark agenda filtered to one track; speaker gallery with company hidden) → both render correctly at `/embed/{id}` inside a test iframe page; Get-code snippet works pasted into a blank html file. Import the fixture CSV → rows appear deduped; export round-trips.
3. Session detail add-to-calendar downloads a valid ICS.
4. Zero-debt self-review + DESIGN.md conformance pass (this is the judges' most-seen surface — density, motion, empty states all per the reference).
