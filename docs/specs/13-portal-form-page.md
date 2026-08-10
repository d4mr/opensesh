# WP13 — Portal form editor: dedicated page with live preview

## Why

Editing a portal form currently happens inside a side Sheet (`PortalFormEditor` in `apps/web/src/components/admin/portal-admin.tsx`). Overlay doctrine (docs/DESIGN.md + user): editors with a lot going on get a DEDICATED PAGE, never a sheet. Linear is the bar.

## Scope

### 1. New route `/admin/portal-forms/$formId`

- Replace the Sheet with a dedicated two-pane page: **left = builder, right = live preview**.
- Builder pane: form name/title/description, sections list, per-section `FormFieldBuilder` (reuse it — it already supports the `datetime` type and takes `timezone`), add/remove/reorder sections, save. Reuse ALL existing mutation server fns (`saveAdminPortalForm`) — no new write paths.
- Preview pane: sticky, renders the form as speakers will see it using the existing `FormRenderer` with `timezone` = event timezone and the event library. Preview updates live as the builder state changes (local state, not saved). Label it with a quiet "Preview — what speakers see" rail.
- Page header: h-11 border-b rail with form name, "Portal form" whisper, Save button (primary, disabled when clean), back link.
- "New portal form" from the list navigates to the same page with a `new` sentinel (or creates a draft first if that is materially simpler — organizer must land in the same editor either way).

### 2. Exact back semantics

- The Portal Forms list keeps its position; navigating back from the editor lands exactly where the organizer was, with the edited form's row briefly highlighted (reuse the spotlight close-highlight treatment from `apps/web/src/components/app/spotlight.tsx` — extract if needed).
- Row click → editor page uses normal navigation (`replace: false`) so browser Back works.

### 3. Remove the Sheet

- Delete the Sheet-based `PortalFormEditor` usage from portal-admin.tsx once the page exists. No dead code left. The response-viewing dialog (single response detail) stays a Dialog — it is a short decision surface.

## Hard rules

- Worktree only, branch `wp13-portal-form-page`. NO git commit/push/deploy, NO prod/remote DB. Local DB `opensesh_wp13` (already in `apps/web/.dev.vars` here), dev port ONLY 3013.
- NO schema changes; migrations untouched.
- Do NOT touch: `packages/domain` (except nothing — this is UI/routing only), profile-approval logic, agenda layout, review-desk decide, spotlight primitive behavior (consume, don't rewrite).
- `pnpm check`, `pnpm test`, `pnpm build` green from repo root; `pnpm run db:reset` green.
- docs/DESIGN.md binding: new-york-v4, dense h-9 rails, 32–36px rows, motion under 300ms.
- Write `REPORT-WP13.md`: what was built, per-surface notes, verification evidence, known gaps.
