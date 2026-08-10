# WP8 report — public widgets and speaker CSV

## What was built

- A shared public event frame at `/e/{slug}` with compact sliding pill navigation, event dates, and location.
- Five published program views:
  - `/e/{slug}/sessions` — searchable/filterable session catalog.
  - `/e/{slug}/speakers` — compact speaker directory.
  - `/e/{slug}/speakers/gallery` — headshot-forward gallery.
  - `/e/{slug}/agenda` — day switching with simultaneous rooms grouped under one time.
  - `/e/{slug}/itinerary` — chronological, print-clean itinerary.
- Published session details at `/e/{slug}/sessions/{code}`, including rich text, speaker bios, schedule metadata, and a generated `.ics` download.
- A standalone `/embed/{embedId}` renderer for all five views, including disabled state, filters, field visibility, theme/`?theme=` override, primary color, 12/24-hour time, and add-to-calendar controls. Responses do not set `X-Frame-Options`.
- An admin Widgets nav item and `/admin/widgets` list/editor with optimistic enabled switches, debounced autosave whisper, two-pane live iframe preview, and copyable iframe code.
- CSV import/export on `/admin/speakers`: case/order-insensitive header mapping, quoted-field parsing, five-row preview, per-row errors, event-scoped email upsert, and matching export columns.
- Two seeded examples: `emb_agenda_dark` (Agents-only dark agenda) and `emb_speaker_gallery` (company hidden).

## Publication boundary

The WP6 `events.publishedAgenda` snapshot is the only source for public session membership, dates, times, rooms, tracks, and speaker membership. Live draft schedule/relationship columns are never returned. For those published session IDs, title, description, format, and level are resolved from WP5's `submissions.approvedSnapshot`, not the mutable submission columns. This means:

- a speaker-authored accepted-session edit with `contentReviewStatus = pending_review` does not leak;
- approval appears publicly without requiring another agenda publish;
- unpublishing produces the explicit empty state on every public program view.

Speaker profile fields retain WP5's existing behavior: profile updates have no pending-review state. If profile approval is added in a later work package, the public read model is the single boundary that must switch to its approved profile snapshot.

## Decisions and tradeoffs

- Public pages and embeds use one Effect-backed read model and one React renderer. This keeps filter, publication, empty-state, and field-visibility behavior identical rather than maintaining ten variants.
- Each public page is served by one joined database wave. The embed lookup and its public program are also one joined database wave.
- Widget JSON is normalized at the repository boundary. Older/partial JSON receives documented defaults without UI compatibility branches.
- CSV parsing is implemented locally instead of adding a dependency. It supports BOM/case/order variance, escaped quotes, commas, and multiline quoted cells; malformed required fields are blocked before import.
- Imported contacts appear in the directory even before a session is attached. This is necessary for a useful CRM import while published speaker views still include only contacts attached to the published agenda.
- Widget data is live on load and after every save; there is no Sessionboard-style 60-minute cache delay. This is also noted in `README.md`.

## Operator walkthrough

1. Reset and start the local-only environment:

   ```bash
   pnpm db:reset
   cd apps/web && pnpm dev --port 3008
   ```

2. Open `http://localhost:3008`, use Demo roles to sign in as Dana Organizer, visit `/admin/agenda`, and click **Publish agenda**.
3. Walk the public site:
   - `http://localhost:3008/e/ai-engineer-nyc-2026/sessions`
   - `http://localhost:3008/e/ai-engineer-nyc-2026/speakers`
   - `http://localhost:3008/e/ai-engineer-nyc-2026/speakers/gallery`
   - `http://localhost:3008/e/ai-engineer-nyc-2026/agenda`
   - `http://localhost:3008/e/ai-engineer-nyc-2026/itinerary`
4. Open a session row and click **Add to calendar**. The browser downloads `sess-*.ics`; it contains `VCALENDAR`, UTC start/end, location, description, UID, and sequence.
5. Snapshot check:
   - Switch to Maya, Lina, or Jamal and edit an accepted session in the speaker portal.
   - Reopen its public session page: the approved version remains visible.
   - Switch to Dana, open `/admin/content`, approve the pending edit, and refresh the public page. The approved copy appears without republishing.
6. Visit `http://localhost:3008/admin/widgets`:
   - Open **Dark agenda** and confirm only Agents sessions render in dark mode.
   - Open **Speaker gallery** and confirm job titles render without company names.
   - Change fields and watch the `Saving…`/`Saved` whisper and live preview refresh.
   - Click **Get code**, copy the iframe, and paste it into a blank HTML file.
7. Direct embed URLs:
   - `http://localhost:3008/embed/emb_agenda_dark`
   - `http://localhost:3008/embed/emb_speaker_gallery`
   - Append `?theme=light`, `?theme=dark`, or `?theme=auto` to override the saved theme.
8. Visit `/admin/speakers`, click **Import CSV**, select the evaluation fixture, inspect mapping and the first five rows, then import. Import the same emails again to see them update rather than duplicate. Click **Export CSV** and reimport the result to verify round-trip fields.

## Verification performed

- `pnpm db:reset` — green against `postgres://.../opensesh_wp8`; seed verification green.
- `pnpm check` — green across all workspace packages.
- `pnpm test` — 2 files / 7 tests green.
- `pnpm build` — landing and Worker builds green.
- Local HTTP checks on port 3008 found eight published sessions across all five routes.
- Both seeded embeds returned `200`, omitted `X-Frame-Options`, and rendered their configured view; the dark Agents agenda rendered two filtered sessions and the gallery rendered eleven speaker cards without company text in visible card markup.
- Repository verification changed a published submission's live title while leaving its approved snapshot intact: the pending title did not appear. Updating the approved snapshot made the new title public immediately, then the fixture was restored.
- CSV verification imported the same email twice: contact count increased once, the second import updated the title, and export correctly quoted comma-containing and multiline fields.

The in-app browser runtime exposed no available browser instance, so a screenshot-based visual click-through could not be completed in this environment. HTTP-rendered markup, repository behavior, compilation, tests, and the production Worker build were verified instead.

## Schema notes

- Added Postgres enum `embed_view`: `sessions`, `speakers`, `speaker_gallery`, `agenda`, `itinerary`.
- Added `embeds`: `id`, `event_id` (cascade FK), `name`, `view`, `enabled`, `options jsonb`, `created_at`, `updated_at`, plus an event index.
- The migrations directory was deleted and regenerated once. There is exactly one flat migration:
  `packages/domain/migrations/20260810121110_yellow_polaris/migration.sql`.
- No production/remote database or deployment command was used. The final local `opensesh_wp8` database is clean-seeded and has its agenda published for immediate review.

## Known gaps

No functional WP8 gaps are known. The only open verification item is a human visual/browser pass because the browser-control runtime was unavailable here.
