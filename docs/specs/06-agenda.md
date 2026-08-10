# WP6 — Agenda: day/rooms schedule builder with drag-and-drop + conflicts

Read `AGENTS.md` first. Prereqs: WP0–WP2 merged. References: `docs/PRD.md` §F8; swyx's clarification — "day/room + drag-and-drop + conflict detection is enough". Fixture: seed has ~8 scheduled sessions across Oct 12–13 including **one deliberate Hall A overlap** — your conflict detection must find it out of the box (it's planted for the judges).

## `/admin/agenda`

Three views (tabs, URL-synced): **Rooms** (default) · **List** · **Conflicts (n)** — badge count live.

- **Rooms view**: grid — columns = rooms, rows = 15-min slots (8:00–19:00), day switcher (Oct 12/13/14, segmented). Session blocks: title, `SESS-n`, track color edge, speakers; height ∝ duration.
  - **Unscheduled pool**: right side panel listing accepted-but-unscheduled submissions (search + track filter). Drag pool → grid to schedule (sets starts_at/ends_at/room). Drag block to move; drag bottom edge to resize (15-min snapping). dnd-kit; drop settle ≤200ms `--ease-out`; the dragged block gets `scale(1.02)` + shadow while lifted.
  - Optimistic updates + undo toast on every mutation. Remove from schedule → back to pool (× on block hover).
- **Conflict detection** (domain layer, pure function over scheduled set, typed + unit-tested): (a) same room, overlapping times; (b) same speaker in two overlapping sessions (via submission_participants). Conflicted blocks: destructive-color ring + warning icon in grid, live as you drag (recompute on drop). **Conflicts view**: each conflict as a card — what, who, where, why + "jump to rooms view" (highlights both blocks, 2s pulse).
- **List view**: TanStack Table of accepted submissions — scheduled?, day/time, room, duration; inline room/time editing via popover (same validation path).
- Scheduling/rescheduling records nothing to email yet, BUT sets `schedule_dirty` marker consumed by WP7's calendar-invite sending (add the column if WP1 didn't; note it).
- **Publish action (eval-critical handoff)**: the agenda is a DRAFT until published. "Publish agenda" button (top right, with "unpublished changes" badge once dirty): snapshots the current schedule to the public agenda page; public pages render the last published snapshot only, never the live draft. Unpublish/republish idempotent. Simplest correct model: `published_at` + published snapshot (JSON or a `published` flag per scheduled slot — pick the one with less code, state which and why).
- Rooms are creatable inline from this screen too ("+ Add room" column stub → same library CRUD as WP3 Part C) — the eval flow defines rooms right before scheduling.

## Acceptance

1. `pnpm typecheck && pnpm build`; seed green; conflict unit tests pass (`pnpm test` — add vitest if absent, minimal config).
2. Walkthrough: Conflicts tab shows the planted Hall A overlap → resolve it by dragging one session to Hall B (badge drops to 0) → drag a pool session onto Oct 14 → resize it to 45 min → create a speaker double-booking on purpose (drag two sessions sharing a speaker into overlap, different rooms) and see it flagged with the speaker named → undo → list view inline-edit a time.
3. 60fps drag on a mid-size grid (transform-only movement; no layout thrash — verify with devtools performance while dragging).
4. Zero-debt self-review + motion checklist.
