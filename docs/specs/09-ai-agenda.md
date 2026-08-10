# WP9 — AI agenda drafts: criteria → generate → compare → accept

Read `AGENTS.md` first. Prereqs: WP6 merged (agenda builder + conflict detector + publish). References: `research/sessionboard/gap-analysis.md` P0 #6 — the AI is a **reviewable draft workflow**, never a direct auto-fill of the live agenda. Rubric: AI Agenda 10%, judged generously — the visible workflow is the points.

## A — `agenda_drafts` table

Flat migration regen per AGENTS.md: id, event_id FK, name, status enum(`draft`,`generated`,`committed`,`discarded`), criteria jsonb, proposal jsonb, generatedAt, committedAt, timestamps.

- `criteria` (typed schema): days (subset of event days), roomIds, includeStatuses (default `["accepted"]`), respectExistingPlacements bool (keep already-scheduled sessions where they are vs. re-place everything), rules: array of freeform strings (e.g. "keynotes in Hall A", "no workshops before 10am", "spread each track across days").
- `proposal`: per-submission `{submissionId, roomId, startsAt, endsAt}` list + per-item `reason` string (one line: why this placement).

## B — Generation

Server fn `generateAgendaDraft`: loads accepted (per criteria) submissions + rooms + existing schedule in one DB wave, then:

1. **LLM pass (when `ANTHROPIC_API_KEY` is configured):** single Messages API call to `claude-sonnet-5` — system prompt carries the constraint rules, user content carries sessions (id/title/format/track/speakers/duration), rooms, days, criteria rules; force a tool call whose input schema IS the proposal shape. Temperature low.
2. **Deterministic fallback (DEMO / no key):** greedy solver — sort by format weight (keynotes first) then track interleave; place into earliest legal slot honoring criteria. Must produce a full valid proposal so the workflow demos without any key.
3. **Validation gate (both paths):** run WP6's conflict detector over the proposal (+ kept placements). Any illegal placement gets repaired by the deterministic placer (never shown broken). The stored proposal is always conflict-free; note repairs in `reason`.

## C — UI on `/admin/agenda`

**"AI drafts"** button (sparkles icon) in the agenda header → right sheet listing drafts (name, status badge, generated time; duplicate/discard row actions). "New draft" → criteria form in the same sheet (days checkboxes, rooms multi, statuses, respect-placements switch, rules as a tag-style list input with placeholder examples). **Generate** shows progress state, then jumps to compare.

**Compare view** (full-width route or takeover panel — pick what reads best with the WP6 grid, state your choice): table of proposed changes — session, current slot/room → proposed slot/room (unscheduled → new placements show "—"), reason, per-row checkbox (default all checked). Header: "Accept n changes" (primary) + "Accept all" + Discard. Accepting applies ONLY checked rows to the live agenda through the same mutation path the drag-and-drop uses (schedule-dirty marker fires for WP7 invites); draft → `committed`. The live agenda is never touched before accept. After commit, jump to the rooms view with changed blocks pulsed (reuse WP6's conflict-jump highlight).

## Acceptance

1. `pnpm check && pnpm build && pnpm test` (solver + validation-gate unit tests: proposal always conflict-free on the seeded fixture including the planted Hall A overlap when respectExistingPlacements=false).
2. Walkthrough (DEMO, no key): create draft "Balanced v1" with a rule "keynotes in Hall A morning" → generate → compare shows placements with reasons → uncheck one row → accept → live agenda gains only checked placements, WP6 conflict badge stays 0 → publish (WP6) → public agenda reflects it. Duplicate the draft, discard the copy — live agenda untouched.
3. With a key configured: same flow, LLM path logs model + latency in the report; validation gate demonstrably repairs at least one adversarial rule ("put everything in one room at 9am" → gate spreads them, reasons say so).
4. Zero-debt self-review + DESIGN.md pass (sheet, compare table density, motion).
