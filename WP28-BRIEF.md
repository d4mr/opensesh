# WP28 — CFP integrity: the builder/save/submit chain (OS-003..008)

Eval P0/P1 items, all verified against this exact commit with file:line evidence. One
previously-unnamed root cause explains three of them: `formEditorForAdmin` cross-joins fields ×
event admins and never de-duplicates the FIELDS. With ≥2 event admins (any event created in the
demo org — createForAdmin adds every org owner/admin, and the org has two owners), every field
renders twice in the builder → duplicated ids → `INSERT ... ON CONFLICT DO UPDATE` hits the same
row twice → Postgres 21000 → "Could not save form fields" forever → every field edit lost.

## Hard rules (non-negotiable)

- NO git commit/push/deploy. NO prod DB. Your DB is `opensesh_wp28` (`apps/web/.dev.vars` points
  at it); `pnpm --filter @opensesh/domain db:reset` re-seeds. Dev port **3028** if needed.
- NO schema changes; do not touch packages/domain/migrations. (Seed FIELD DATA changes are fine —
  seeds are TypeScript, not schema.)
- Read AGENTS.md (Effect v4: verify APIs against vendor/effect) and docs/DESIGN.md for any UI.
- Finish: `pnpm check` clean; db:reset ends "Seed verification passed"; REPORT-WP28.md at root.

## Fix 1 — de-duplicate the form editor read model (OS-005, highest leverage)

- packages/domain/src/server/repos/read-models.ts: `formEditorForAdmin` (~:417-448) left-joins
  formFields AND listedAdmin/users → rows = fields × admins. Admins are deduped (:513-521), fields
  are NOT (`decodePublicForm` flatMaps bare at :147-151). Preferred fix: drop the admin joins from
  the base query and fetch admins via the existing `events.listAdmins` (repos/events.ts:248-257)
  as a parallel effect; otherwise dedup fields by id with a Map. Either way also dedup
  defensively in repos/forms.ts `replaceFields` (:166) before the insert.
- Acceptance: an event with 2+ admins shows each field exactly once in the builder; saves succeed.

## Fix 2 — atomic form saves (OS-004)

- Introduced by 06ae18d: apps/web/src/server-fns/forms.ts:158-167 runs `forms.update` and
  `forms.replaceFields` via Effect.all concurrency 2; replaceFields ITSELF runs prune+upsert
  concurrently (repos/forms.ts:207) on different pool connections (db.ts max:5) = separate
  transactions.
- Fix: add `saveWithFields(formId, form, fields)` to FormsService as ONE `db.transaction`
  (mirror `duplicate` at repos/forms.ts:121-152): update form row, delete pruned fields, upsert
  ordered fields. server-fns/forms.ts calls it; keep the parallel auth READS as they are. Return
  after commit so the client cache only updates on success.
- Acceptance: force a field failure (e.g. temporarily oversize an id) → NEITHER form row nor
  fields change; success changes both together and survives reload.

## Fix 3 — participant role mismatch (OS-003)

- apps/web/src/routes/submit.$eventSlug.$formId.tsx:53-63 `participantForEmail` hardcodes
  role:"speaker" (line 60; payload producers at :135/:167/:452). packages/domain/src/server/
  cfp.ts:207-216 counts by EXACT string match against the form's participantRoles — DevFlow seed
  defines "Primary speaker" (min1/max1) + "Co-presenter" (0/3) → count 0 → the exact eval error.
- Fix: thread the form's ENABLED roles into the wizard: first participant gets the first enabled
  role, extras get the next enabled role (fall back to first when only one). Add/remove bounds
  use the SUM of enabled min/max instead of participantRoles[0] (:417/:450); card labels use the
  role name instead of hardcoded "Speaker {n}" (:412). Server-side (cfp.ts): defensively coerce
  an unknown/legacy "speaker" role to the first enabled role before counting so old drafts still
  submit.
- Acceptance: on DevFlow's seeded form, a submission with 1 Primary speaker + 1 Co-presenter
  submits successfully and both participants store the correct role strings.

## Fix 4 — publish validation + loud participant errors (OS-007)

- No publish-time validation exists (only the locked-Title check at server-fns/forms.ts:150-157).
  The DevFlow seeded form requires 1 participant but has ZERO participant-section fields.
  Additionally cfp.ts upsertParticipants (:124-131) SILENTLY DROPS any participant without a
  mapsTo:"email" answer — silent data loss.
- Fix: in saveForm, when `status === "open" && collectParticipants && some enabled role min>0`,
  require at least participant-section fields mapping to email (ideally also first/last name);
  fail with actionable InvalidInput ("Participant collection needs an email question — add it in
  the Speakers step"). Surface the message on the builder step panel, not only a toast (follow
  DESIGN.md — quiet inline error text, no banner box). In upsertParticipants, replace the silent
  `continue` with InvalidInput when a REQUIRED participant lacks a resolvable email.
- Seed: give the DevFlow form the three locked participant fields (mirror seed/data.ts:461-508)
  so the seeded demo is internally valid.

## Fix 5 — editor state hygiene (OS-006)

- The type-select handler is correct; failures came from Fix 1 + missing invalidation + unstable
  keys: fieldId falls back to `${section}-${position}` (admin.forms_.$formId.tsx:106) used as
  React key AND sortable id → collisions when ids are absent; formEditorQuery staleTime 30s and
  persist() never invalidates → leaving and returning within 30s resurrects stale fields.
- Fix: mint `crypto.randomUUID()` for any editor row lacking an id (drop the position fallback);
  after successful saveForm, update the cache (setQueryData with the saved payload or
  invalidateQueries). Give the Required switch an explicit id + htmlFor (:418-425).
- Acceptance: short text → long text → dropdown with a reload after each — builder and public
  form agree every time.

## Fix 6 — seeded description limit (OS-008)

- seed/seed.ts:242: `maxChars: fieldType === "textarea" ? 5000 : 255` gives the DevFlow RICHTEXT
  Description 255 chars — and packages/domain/src/server/schema/forms.ts:232-237 enforces the
  limit on raw HTML including tags. The canonical 386-char eval fixture fails.
- Fix: explicit sensible maxChars per seeded field (Description 5000); in schema/forms.ts strip
  tags before measuring richtext length (simple `replace(/<[^>]*>/g, "")` is fine — measure text,
  not markup). Also add a canonical Description field (richtext, 5000, mapsTo description,
  position 2) to `createForm`'s default abstract set (server-fns/forms.ts:71-83) — new forms
  should start Title + Description, not Title alone.

## Verify end-to-end (dev :3028, fresh db:reset)

Full fresh chain: create a new form → builder shows Title+Description once each → edit types
with reloads → publish → submit the public wizard on DevFlow's seeded form with 386-char
abstract + Primary speaker + Co-presenter → confirmation → submission visible in admin.
`pnpm check` clean. Write REPORT-WP28.md (include which acceptance steps you ran). Do not commit.
