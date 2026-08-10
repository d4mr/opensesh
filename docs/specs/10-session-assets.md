# WP10 — Session assets (gap P0#3)

## Why

Sessionboard models speaker-uploaded **session files** as first-class session content — configured per event (what to upload, due when, what types), uploaded per session, versioned, commented, visible from both the organizer's session view and the speaker portal. Our current model only has task-owned `file_requests`; a session's files feel bolted onto tasks instead of native to the session. This WP makes the session own its assets. See `research/sessionboard/gap-analysis.md` P0 #3.

## Scope

### Schema (packages/domain)

- New table `session_file_requirements`:
  - `id`, `event_id` (cascade FK), `title` (e.g. "Slides"), `description`, `due_at timestamptz null`, `accept_types text null` (comma list like `.pdf,.key,.pptx`; null = any), `max_size_mb integer null`, `position integer`, timestamps.
- `file_uploads` gains nullable `requirement_id` FK → `session_file_requirements` (set null on delete). An upload row for a session asset has `submission_id` set + `requirement_id` set + `kind = 'slides'` (reuse the existing kind; no new enum values).
- Existing `file_versions` and `file_comments` are reused untouched — the asset thread IS the existing FileThread.
- Migrations: delete every directory under `packages/domain/migrations/` and regenerate exactly ONE flat migration with `pnpm run db:generate`.

### Domain / repos

- Portal `speakerBootstrap`: include the event's `session_file_requirements` and make sure `files` rows carry `requirement_id` (they come from `file_uploads` already — just select it). The speaker needs, per accepted session they're on: each requirement + the matching upload (or none).
- Portal `adminBootstrap`: include requirements too.
- `prepareFileUpload`: accept an optional `requirementId`. Rules: the contact must be a participant on the submission; the submission must be accepted (`status = 'accepted'`); one upload row per (submission, requirement) — re-upload adds a version to the existing row (same as file requests today). Enforce `max_size_mb` when set (reject larger), and pass `accept_types` to the client for the file input's `accept` attr (server-side: extension check when accept_types set).
- Requirement CRUD for organizers: `saveSessionFileRequirement` (insert/update) + list comes from bootstrap. Delete can wait — out of scope.
- IMPORTANT: do not touch the headshot gating inside `recordFileVersion` (profile approval pipeline) or `updateProfile` — they were just landed and are verified.

### Web surfaces

- **Portal → Submissions**: on each *accepted* submission's detail view, a "Files" section: one row per requirement — title, due date ("due Sep 30" / overdue in destructive text), upload button (or "Replace"), and the existing `FileThread` (versions + comments) when an upload exists. Dense rows per docs/DESIGN.md — no card-in-card.
- **Admin → Content → SessionPeek** (apps/web/src/components/admin/portal-admin.tsx): add a "Files" section to the existing peek sheet: per requirement, the upload with FileThread (admin can comment + download), plus a "Download all" button reusing the existing zip helper when ≥1 file exists.
- **Admin → File Requests page**: add a compact "Session file requirements" management block ABOVE the existing file-request list: rows of title · due · types · size cap, inline add/edit (small dialog or inline form, match the existing page's patterns). Keep the existing task-linked file requests untouched below.
- A task template can still point speakers at uploads (unchanged) — tasks link to the surface, they don't own the asset.

### Seed

- Two requirements for the event: "Slides" (due 5 days before event start, `.pdf,.key,.pptx`, 50 MB) and "Intro one-pager" (no due date, `.pdf`, 10 MB).
- One seeded upload: Maya's SESS-21 slides v1 with one organizer comment ("Looks great — can you add a title slide with the session code?") and one speaker reply. Store a small real PDF-ish placeholder body via the seed's existing file seeding approach if one exists; if seed doesn't currently write to R2, seed only the DB rows with a storage key that the download route treats as missing gracefully — check how existing seeded uploads (if any) handle this and match.
- Keep `pnpm run db:reset` + all verifiers green (`cfp:verify`, `review-desk:verify`, `mail:verify` — run each after a fresh `db:reset`; they mutate state).

## Hard rules (unchanged from prior WPs)

- Work ONLY in this worktree; branch `wp10-session-assets`.
- NO `git commit`, NO push, NO deploy, NO prod/remote database. Local DB is `postgres://postgres:postgres@localhost:5433/opensesh_wp10` (already in `apps/web/.dev.vars` here).
- Dev server ONLY on port 3010 (`pnpm dev --port 3010` in apps/web).
- Regenerate the single flat migration (delete all migration dirs first).
- `pnpm check`, `pnpm test`, `pnpm build` must pass from the repo root.
- Follow `docs/DESIGN.md` exactly: dense rows, one earned border, footer rails, whispers not spinners, peek sheets over inline expansion.
- Write `REPORT-WP10.md` at the worktree root: what was built, decisions, schema notes, operator walkthrough, verification evidence, known gaps.
