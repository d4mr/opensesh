# WP9 — AI agenda drafts report

## What was built

- A typed `agenda_drafts` event-plane table with `draft`, `generated`, `committed`, and `discarded` states; JSONB criteria and proposal payloads; generated/committed timestamps; and cascade ownership through `events`.
- `generateAgendaDraft`, list, duplicate, discard, and accept server functions behind the existing admin organization check.
- A deterministic no-key solver that orders keynotes first, interleaves tracks within format priority, chooses the earliest legal 15-minute slot, honors the supplied days/rooms, avoids room and speaker overlaps, and handles the documented keynote/workshop/track rule examples.
- An optional Anthropic Messages API path selected only when `ANTHROPIC_API_KEY` is present. It makes one forced `propose_agenda` tool call using `claude-sonnet-5`, low temperature, and JSON Schema generated directly from the Effect proposal schema.
- A shared validation-and-repair gate for deterministic and model output. It validates full coverage, event bounds, selected rooms/days, exact durations, and every candidate against WP6's `detectAgendaConflicts`; repaired rows say `Repaired by validation gate: earliest conflict-free slot.`
- The `/admin/agenda` workflow:
  - **AI drafts** opens a compact right sheet with draft history, generated time, status, duplicate, and discard.
  - **New draft** keeps criteria in the same sheet: day and room pick-lists, accepted status, respect-existing switch, and tag-style freeform rules.
  - **Generate** uses a quiet progress whisper and moves directly to a full-width compare state.
  - Compare uses a dense TanStack Table with current → proposed slots, one-line reasons, default-all row selection, **Accept n changes**, **Accept all**, and **Discard**.
  - Accept uses the same transactional schedule persistence helper as WP6's single-session mutation, setting `schedule_dirty` and `agenda_dirty`; only checked rows are applied and the draft becomes committed.
  - Successful acceptance returns to Rooms and pulses changed blocks using WP6's existing highlight treatment.
- Solver and adversarial validation-gate unit tests based on the seeded 12 accepted sessions and planted Hall A overlap.

No public `/e` route or embed/widget code was changed.

## Decisions and tradeoffs

- Compare is a full-width takeover inside `/admin/agenda`, encoded by the `draft` search parameter. The right sheet is ideal for short draft/criteria tasks, but the current/proposed/reason table needs the agenda's full horizontal width.
- `includeStatuses` remains part of the typed criteria shape and defaults to `["accepted"]`. WP9 only permits accepted submissions because WP6's scheduling mutation intentionally rejects every other status; exposing other choices would create drafts that cannot be committed through the required path.
- **Respect existing placements** defaults off in the new-draft UI so the demo visibly produces a complete alternate program. When enabled, legal existing placements stay fixed; a pre-existing illegal placement can still be repaired because the conflict-free storage guarantee takes precedence.
- Freeform rules are unbounded natural-language input for Claude. The fallback deliberately implements only the three specified deterministic patterns (keynote room/morning, workshop lower-bound time, and track spreading); other text remains a prompt preference rather than pretending to be a general parser.
- A generation failure after the initial insert leaves a visible `draft` record rather than hiding the attempt. It can be duplicated or discarded, while the live agenda remains untouched.

## Design self-review

| Before | After | Why |
| --- | --- | --- |
| No draft-management surface | Right sheet with a bordered divided-row list and compact criteria form | Draft history and short configuration fit the established spatial sheet pattern. |
| A compare table inside the narrow sheet | Full-width dense compare takeover | Current slot, proposed slot, and reason remain scannable without cramped columns. |
| Async generation represented only by a disabled action | In-place `aria-live` progress whisper | Communicates work without spinner theater or moving the live agenda. |
| New interaction-specific motion | Existing 120ms `.pressable`, 220ms `.wizard-step`, 250ms sheet motion, and WP6 pulse reused | Keeps all interaction feedback under 300ms, uses the established easing tokens, and respects reduced motion. |
| Potential card-heavy criteria UI | Type hierarchy, selected-row fills, one earned border per enumerable group, and a footer rail | Matches `DESIGN.md` density and flat Vercel-style surface hierarchy. |

## Schema notes

The previous migration directory was removed and one fresh flat init migration generated:

`packages/domain/migrations/20260810122429_salty_mojo/migration.sql`

New enum:

```text
agenda_draft_status = draft | generated | committed | discarded
```

New table:

```text
agenda_drafts
  id text primary key
  event_id text not null references events(id) on delete cascade
  name text not null
  status agenda_draft_status not null default draft
  criteria jsonb not null
  proposal jsonb not null default {"placements":[]}
  generated_at timestamptz null
  committed_at timestamptz null
  created_at timestamptz not null
  updated_at timestamptz not null
```

The seed verifier now expects the table and confirms it starts empty. The reset was guarded and run only against `localhost:5433/opensesh_wp9`; no remote database was accessed.

## Operator walkthrough

1. Start/reset only the local WP9 database and run the required dev port:

   ```bash
   docker start opensesh-pg
   pnpm db:reset
   cd apps/web && pnpm dev --port 3009
   ```

2. Open `http://localhost:3009/login`, use **Demo roles → Dana**, then open `http://localhost:3009/admin/agenda?view=rooms`. The seeded agenda begins with one planted conflict.
3. Click **AI drafts → New draft**. Enter `Balanced v1`, leave all days/rooms selected, leave **Respect existing placements** off, and add `keynotes in Hall A morning` with Enter.
4. Click **Generate**. Confirm the progress whisper appears and compare opens without any live agenda blocks moving.
5. Confirm compare shows current → proposed values and a reason on every changed row. Uncheck one currently unscheduled session, then click **Accept 11 changes**.
6. Confirm Rooms opens, changed blocks pulse, the conflict badge is `0`, and **Unpublished changes** is visible. The unchecked session remains unscheduled.
7. Click **Publish agenda**, then open `http://localhost:3009/e/ai-engineer-nyc-2026/agenda` and confirm the accepted schedule snapshot is visible.
8. Return to Admin Agenda, open **AI drafts**, duplicate `Balanced v1`, then discard the copy. Rooms and the published schedule remain unchanged.

### Optional Claude path

Add `ANTHROPIC_API_KEY=<secret>` to `apps/web/.dev.vars`, restart the same port 3009 process, and repeat generation. Each request logs exactly:

```text
[agenda-draft] model=claude-sonnet-5 latencyMs=<number>
```

The proposal still passes through the deterministic gate before storage. The validation-gate unit test injects the adversarial equivalent of “put everything in one room at 9am” and proves that overlapping rows are spread with repair reasons.

## Verification evidence

All required commands passed after the final implementation:

```bash
pnpm check
pnpm test
pnpm build
```

- `pnpm test`: 3 files, 9 tests passed, including the seeded deterministic solver and adversarial validation gate.
- Local integration walkthrough (no API key): 12 placements generated; live schedule fingerprint unchanged before accept; 11 checked changes accepted; 0 conflicts afterward; duplicate → draft; discard → discarded; duplicate/discard left the live fingerprint unchanged; publish produced 11 public sessions.
- `pnpm db:reset`: all seed table counts passed, `agenda_drafts = 0`, and the original single planted overlap was restored after integration verification.
- Production client and Worker build completed successfully. The baseline landing build still reports its existing unresolved-at-build-time `/dither-fade.png` warning; it does not fail the build or involve WP9.

## Known gaps

- No `ANTHROPIC_API_KEY` was configured, so no paid external model request was made and there is no real model latency sample. The exact model/tool payload, configuration branch, response decoding, and latency log are implemented; deterministic generation is the verified demo path.
- No Browser backend was connected in this session, so screenshot-level visual QA could not be automated. The dev server compiled on port 3009, package checks/build passed, and the complete workflow was verified against the local database/service boundary. The operator walkthrough above is the remaining visual pass.
- The repository's documented `vendor/effect` checkout is absent in this worktree. Effect v4 API usage was checked against the installed, pinned `effect@4.0.0-beta.106` source in `node_modules` instead.

Nothing was committed, pushed, deployed, or written to a remote database.
