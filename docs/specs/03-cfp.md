# WP3 — CFP: form builder (admin) + public submission wizard

Read `AGENTS.md` first. Prereqs: WP0–WP2 merged (scaffold, domain+seed, auth+shells). Reference material in-repo: `docs/PRD.md` §F2–F3, `research/image-notes-forms.md` (exhaustive descriptions of the original product's builder + public wizard — match the *behavior and information architecture*, not the pixels). The seeded submission form from WP1 is your fixture.

Sequencing note: this WP shares form-rendering surface with nothing else in flight; the public wizard renderer you build here is reused by WP5's portal forms — keep `FormRenderer` self-contained (`src/components/forms/`).

## Part A — Admin form builder (`/admin/forms`, `/admin/forms/$formId`)

List page: shadcn `card` list of forms — name, Open/Closed badge (derived from close_date + status), "N submissions · N drafts", close date, created; actions: edit, duplicate, copy public link, delete (confirm dialog). "+ Create form" → wizard.

Editor: left step rail + main panel (6 steps — Payments is omitted deliberately):
1. **Setup** — collect kind (Abstracts | Sessions cards), participants toggle.
2. **Welcome** — internal name*, external title*, page heading* (≤15 chars, live counter), welcome message (rich text — use a minimal editor; if you add a dep for this, TipTap starter-kit is the approved choice, nothing heavier) with show/hide toggle.
3. **Submission questions** — section title/heading/instructions; question list: locked system field Title (text, 255, required, non-removable — lock icon), then editable fields: label, type (text | textarea | richtext | email | phone | dropdown | checkbox), max chars, required toggle, dropdown options (bind to library: Format/Track/Tags/Level — or custom option list), **basic conditional logic**: "show when [other field] [equals | is one of] [value]" (one condition per field max — per swyx "conditional fine for now"), drag reorder (dnd-kit, 150ms settle), add/remove.
4. **Participant questions** — same list model; locked First Name/Last Name/Email; role config: Speaker enabled with min/max (default min **1**/max 3).
5. **Settings** — close date (datetime, event timezone), submission limit override (chip shows "Event default: 3"), allow multiple drafts toggle, success message (rich text) — this MUST render on the public confirmation page, auto-redirect-to-portal toggle (10s).
6. **Notifications** — submitter confirmation email toggle + editable body (rich text + `{{name}}`, `{{title}}`, `{{portal_link}}` placeholders documented inline); admin-alert recipients (multi-select of event admins) — record only; sending lands in WP7.

Persist per-step (save on step change + explicit Save; optimistic, sonner toast on failure only). "View form" opens the public URL. All mutations: server fns → Effect programs, typed errors; form + field schemas from WP1 extended as needed.

## Part B — Public wizard (`/submit/$eventSlug/$formId`)

Five steps, top step indicator with the admin-configured page headings: Welcome → Account → Submission → Participant → Review.

- Banner: close date ("Submissions close September 15 at 11:59 PM EST") + "Limit: N submissions per user" when set.
- **Welcome**: external title + welcome message rendered; Continue.
- **Account**: email → magic link (better-auth, WP2 flow; DEMO_MODE shows link inline); if already signed in, show "continuing as {email}" + switch account. Returning users with drafts/submissions see them listed with resume/edit links.
- **Submission**: rendered from form definition — TanStack Form + a validator built from the field definitions via `effect/Schema` (`standardSchemaV1`); char counters where max set; conditional fields appear/disappear (150ms, opacity+height, `--ease-out`); required enforcement; draft autosave (debounced server fn; "Saved" whisper, no toast spam).
- **Participant**: role min/max enforced (add/remove speaker blocks); locked fields prefilled from account email where sensible.
- **Review**: read-only summary grouped by section, edit links jump to step; Submit.
- Enforcement in the domain layer (typed errors, surfaced as inline messages): `FormClosed` (close date passed — also blocks edits), `SubmissionLimitReached` (drafts count toward limit).
- Success page: the admin-configured success message, confirmation email recorded to email_log (send = WP7), auto-redirect to `/portal` after 10s if enabled (with a visible "going to your portal…" line + cancel).
- Mobile-clean, fast, zero unnecessary JS; this page is judged hardest. Motion per AGENTS.md doctrine only.

After submit: submission exists with `SESS-n` code, status `pending` (kind per form), answers mapped (`maps_to` fields → columns, custom → `answers` JSON), participants created/linked as contacts, source = form. Verify against seeded expectations.

## Acceptance

1. `pnpm typecheck && pnpm build`; seed still green.
2. Walkthrough (record exact clicks in report): create a new form with one conditional field → set close date + limit 2 → open public link incognito → sign in via magic link → submit twice (2nd hits limit) → draft persists mid-wizard on refresh → submission appears in DB with correct mapping (verify via seed:verify-style query) → success message renders → close the form → public link shows closed state and edits are blocked.
3. Seeded form renders correctly through the whole wizard.
4. Zero-debt self-review + AGENTS.md motion checklist pass on everything you animated.
