# WP25 — Permissions model, portal preview, OS-001/OS-002

You are implementing a fully-designed permissions overhaul in this worktree. The design below was
produced from a verified code exploration — file paths and line references were checked against
this exact commit. Follow it; where reality disagrees, favor the intent and note it in the report.

## Hard rules (non-negotiable)

- NO git commit, push, or deploy. Leave all changes uncommitted in the working tree.
- NO prod database. Your DB is `opensesh_wp25` (already created/seeded; `apps/web/.dev.vars` in
  this worktree points at it). `pnpm --filter @opensesh/domain db:reset` re-seeds it.
- Dev server port is **3025** (`pnpm --filter web dev --port 3025`) if you need to run it.
- NO schema changes are needed for this WP. Do not touch `packages/domain/migrations/`.
- Do NOT run `cf-typegen`.
- Read `AGENTS.md` first (Effect v4 beta discipline: verify APIs against `vendor/effect`), and
  `docs/DESIGN.md` for every UI decision — this repo holds a strict Linear-grade bar: dense,
  quiet, flat; no banner boxes for routine metadata; sentence case; muted copy.
- When done: `pnpm check` must pass clean, seed verify scripts must pass
  (`pnpm --filter @opensesh/domain db:reset` ends with "Seed verification passed"), and write
  `REPORT-WP25.md` at the worktree root: what changed per file, decisions taken, anything
  you could not finish, and manual test notes.

## Context

opensesh is a conference-program SaaS (TanStack Start on Cloudflare Workers, better-auth with the
organization plugin, Drizzle/Postgres, Effect v4). Org roles: owner/admin/member (better-auth,
creator becomes owner). Event overlay roles: admin/reviewer (`eventMembers`). Speakers are
CONTACTS, not org members. Demo personas: Dana (org owner + event admin), Rey (org member + event
reviewer), Maya/Lina/Jamal (speakers via contacts). The authority is
`packages/domain/src/server/current-user.ts` (`CurrentUser`, `requireCurrentUser`).

Current defects being fixed:
1. Org members without event roles fail the `staff` check → bounced from /admin to /portal →
   "You do not have access" (they see NOTHING).
2. Admins clicking "View portal" get Forbidden (no contact record) — no preview, no way back.
3. Fresh signups get auto-enrolled into the seeded demo org by a domain-suffix hook in
   `apps/web/src/lib/auth.ts` (`keepsDemoMembership`, ~line 32) → they land in a seeded portal
   with no access instead of onboarding (eval issue OS-001).
4. "Create organization" in the org switcher navigates to /onboarding, whose beforeLoad bounces
   users who already have an org straight back to /admin — a no-op (eval issue OS-002).
5. None of the role semantics are surfaced in workspace settings.

## Implementation plan (ordered)

### 1. OS-002 — Create organization actually works
- `apps/web/src/routes/onboarding.tsx`: add `validateSearch` for `new` (boolean-ish). When
  `?new=1`, skip the has-org redirect in beforeLoad and start the wizard at step 0 with a blank
  org form (ignore `existingOrganization`).
- `apps/web/src/components/org-switcher.tsx` (~line 116): "Create organization" navigates to
  `/onboarding?new=1` (use router navigation, not window.location.assign, if practical).
- `apps/web/src/server-fns/organization.ts` `createOrganization`: after
  `auth.api.createOrganization`, call `auth.api.setActiveOrganization({ body: { organizationId },
  headers })` so the wizard finishes inside the NEW workspace.
- Acceptance: as Dana, Create organization → wizard → new empty workspace, switcher shows both
  orgs, no cross-org data bleed. Fresh-DB acceptance: new user → onboarding → create org →
  empty dashboard.

### 2. OS-001 — fresh signups reach onboarding
- `apps/web/src/lib/auth.ts`: DELETE the `keepsDemoMembership` databaseHooks auto-enroll (the
  demo personas and seeded evaluator emails are seeded with real memberships already — the hook
  is pure hazard). Result: a brand-new email has zero memberships → `NeedsOrganization` (428) →
  routed to `/onboarding`.
- `apps/web/src/routes/onboarding.tsx` beforeLoad 403 fallback (~line 39): keep the /portal
  redirect ONLY for contact-fallback users (see step 3); org members can no longer 403 here.
- Acceptance: brand-new email signup → magic link → lands on Create workspace with NO seeded
  org/event visible anywhere.

### 3. Roles core — members see the workspace; speakers work without org membership
- `packages/domain/src/server/current-user.ts`:
  - Add `member: boolean` to the roles struct (true whenever an org membership resolves).
  - `requireCurrentUser`: `"staff"` now passes for ANY org member (admin || reviewer || member).
  - Contact fallback: when the user has ZERO org memberships, before failing NeedsOrganization,
    look up `contacts` by email; if found, synthesize the viewer from that contact's event/org
    with `roles: { admin: false, reviewer: false, member: false, contactId }`. Genuine external
    speakers then work without any org membership.
- `packages/domain/src/server/repos/events.ts` `listForAdmin` (~line 122): accept plain org
  membership (org member sees all the org's events); drop the reviewer-only single-event filter
  (~line 188).
- `apps/web/src/routes/index.tsx`: order staff (incl. member) → /admin; else contactId →
  /portal; else 428 → /onboarding.
- `apps/web/src/components/app/admin-shell.tsx` (~line 116): non-admin org members get a reduced
  nav: Overview + My Reviews (reviewers already have My Reviews; members get it too — their
  assignment list will just be empty until assigned). Everything else stays admin-gated. Server
  fns already enforce `require: "admin"` on mutations — do not weaken any server-side guard.
- Demo personas must still work exactly as today (Dana admin surfaces, Rey reviewer desk,
  speakers portal).

### 4. Portal preview for staff + Back to admin
- `apps/web/src/server-fns/portal.ts` `getSpeakerPortal` (~line 63): change `require: "speaker"`
  to the session-level guard; handler logic:
  - contactId present → normal `portal.speakerBootstrap(contactId)`.
  - else if staff (admin/reviewer/member) → resolve current event, pick a representative contact
    (prefer one WITH submissions — seeded Maya shape), run the same bootstrap, and return it with
    an ADDITIVE `preview: { contactId, contactName }` field (additive so portal consumers don't
    ripple).
  - else Forbidden (unchanged).
- `apps/web/src/components/app/portal-shell.tsx`: when bootstrap carries `preview`, render a slim
  preview strip above the header — NOT a fat banner. House style: one `h-9`-ish `border-b
  bg-muted/40 text-xs` line: "Previewing as {name} — speakers see exactly this." with a
  "Back to admin" link (TanStack `Link to="/admin"`) right-aligned. Check docs/DESIGN.md §"do
  not" list: no banner boxes — keep it a quiet strip, not a callout.
- `apps/web/src/components/app/user-menu.tsx`: add a `context: "admin" | "portal"` prop; in
  portal context for staff users add a "Back to admin" menu item (Link to /admin). This is the
  REQUIRED return path (user asked for it in the top-right profile menu specifically).
- `apps/web/src/components/app/site-header.tsx` (~line 23): show "View portal" for all staff
  (currently admin-gated), since preview now works for reviewers/members too.
- Portal mutations still require a real speaker — in preview they fail with a toast; that is
  acceptable for this WP (the strip sets expectations).

### 5. Workspace settings surface
- `apps/web/src/components/organization/org-settings-dialog.tsx` MembersSection: add a compact
  roles legend at the bottom — three quiet muted lines, Linear-style: "Owner — everything,
  including the organization profile and other owners." / "Admin — runs events, speakers,
  reviews, and members." / "Member — sees events and reviews sessions they're assigned." No
  matrix UI, no table.
- Invite role selects (this dialog AND `routes/onboarding.tsx` InviteRow): add one-line muted
  descriptions to the SelectItems so the choice is explained where it's made.
- `apps/web/src/server-fns/organization.ts` `getOrganizationSettings` (~line 208): drop to the
  staff guard so members can open settings read-only (UI already disables controls for members —
  verify it actually does after your changes).
- `org-switcher.tsx`: show "Organization settings" to all members.

### 6. Verify
- `pnpm check` clean.
- `pnpm --filter @opensesh/domain db:reset` → "Seed verification passed".
- Manual (dev server :3025, use the Demo roles button bottom-right): Dana sees admin + View
  portal preview strip + Back to admin; Rey sees reviewer desk + events list + working portal
  preview; Lina sees her real portal (NO preview strip); org settings shows the roles legend.
  Create organization from the switcher works end to end.

Write REPORT-WP25.md and stop. Do not commit.
