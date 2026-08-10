# WP12 — Event settings overhaul: icon, previews, markdown, real datetime pickers

## Why

The current Settings page is a bare "Basics" card with native datetime-local inputs and a plain textarea — severely lacking against Sessionboard's event setup (see `docs/PRD.md` and `research/sessionboard/` for the settings surface: event identity, branding, dates/timezone, location, website, description, submission limits). This WP makes Settings a real surface and fixes date/time entry everywhere.

## Scope

### 1. Event icon upload with preview surfaces

- Events already have `logoUrl`; add `logoKey text null` (R2 object key) if not present.
- Settings gains a **Branding** section: drag/click upload (PNG/JPG/SVG ≤ 2 MB) stored in R2 via the existing FILES binding upload path (mirror the headshot upload flow: base64 server fn → R2 put → key on the event row). Fallback to `logoUrl` URL input for remote logos.
- **Preview surfaces** (the point of this feature): immediately next to the uploader, render the icon exactly as it will appear in each consuming surface, labeled and at true size:
  - Sidebar org/event switcher (32px, rounded-md) — and actually wire the sidebar to render the event icon when set (today it shows the static logo mark).
  - Speaker portal header (24px).
  - Email header (48px) — show inside a mini email-frame mock; wire `renderEmail`/templates to include the logo when set.
  - Public site header `/e/{slug}` (28px) — wire the public frame to use it.
  - Favicon-size (16px) row to show how it degrades.
- Uploading updates all previews instantly (object URL) and persists on save; the consuming surfaces above must actually read it (this is not a mock — wire each one).

### 2. Real date/time editing (shadcn quality)

- Build `apps/web/src/components/forms/datetime-picker.tsx`: shadcn Popover + Calendar (single month) + a time field (h:mm, 15-min step select or masked input) + the event timezone shown inline as a suffix chip (e.g. "EDT") — value model is UTC ISO, display in the event timezone. new-york-v4 components only.
- Timezone picker: searchable Combobox over `Intl.supportedValuesOf("timeZone")` grouped by region, showing current offset (e.g. "America/New_York · UTC-4"). Replaces the plain text input.
- Settings uses these for starts/ends + timezone. Validation: ends after starts; changing timezone re-displays times without shifting the stored instant (explicitly state this in a help whisper).
- Reuse the same picker in the **Forms builder**: new field type `datetime` (see below) and any admin surface currently using `<input type="datetime-local">` (audit: settings, forms builder deadline fields, task/file due dates if any).

### 3. Markdown description

- Settings description becomes the existing TipTap `RichTextEditor` (markdown-backed, same as bios). Public `/e/{slug}` renders it (index page) — wire it.

### 4. Forms: `datetime` field type

- `form_fields` field type enum gains `datetime` (check how fieldType is stored — if it's a text column with app-level literals, extend the Effect schema literals).
- Builder: organizers can add a Datetime question; optional min/max.
- Public CFP wizard + portal forms render the shadcn datetime picker with the event timezone indicated; answer stored as UTC ISO string; submission detail + CSV export render it formatted in the event timezone with tz abbreviation.
- Seed: add one datetime field to the seeded portal form ("Hotel check-in") so the demo shows it end to end.

### 5. Settings parity sweep (fast wins only)

Fields Sessionboard has that we already store but do not expose — expose them in Settings with proper inputs: `type` (conference/summit/meetup select), `websiteUrl`, `defaultSubmissionLimit` (number, with a whisper explaining it gates the CFP), `slug` (read-only with copy button + public URL preview). Group the page: Basics / Schedule / Branding / Submissions. Keep the dense card grammar of docs/DESIGN.md (h-9 section header rails, not big CardHeaders).

## Hard rules

- Worktree only, branch `wp12-event-settings`. NO git commit/push/deploy, NO prod/remote DB. Local DB `opensesh_wp12` (in `apps/web/.dev.vars`), dev port ONLY 3012.
- Migrations: delete all of `packages/domain/migrations/` and regenerate ONE flat migration.
- Do NOT touch: profile-approval logic in portal.ts, agenda layout (agenda-page/rooms-view), review-desk decide flow.
- `pnpm check`, `pnpm test`, `pnpm build`, `pnpm run db:reset` + verifiers (`cfp:verify`, `review-desk:verify`, `mail:verify` — each after a fresh reset) all green.
- docs/DESIGN.md binding; new-york-v4 only; no native datetime-local inputs anywhere when done.
- Write `REPORT-WP12.md` with the standard sections.
