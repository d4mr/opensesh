# WP25 report

## What changed

- `packages/domain/src/server/current-user.ts`
  - Added `roles.member` for every resolved organization membership.
  - Allowed every organization member through the staff guard.
  - Added contact-by-email fallback for signed-in users with no organization memberships, including event and organization resolution for contact-only speakers.
- `packages/domain/src/server/repos/events.ts`
  - Made the admin event list organization-membership scoped instead of event-role scoped, so members can see every event in their organization.
- `packages/domain/src/server/repos/submissions.ts`
  - Removed the event-role requirement from the read-only dashboard query. Organization membership remains required.
- `packages/domain/src/server/repos/contacts.ts`
  - Added deterministic portal-preview contact selection, preferring a contact attached to a submission. The seeded event resolves Maya Chen with two submissions.
- `packages/domain/src/seed/seed.ts`
  - Kept organizer/reviewer users as organization members and made speaker personas contact-only, matching the permissions model and preserving their real portal routing.
- `packages/domain/src/seed/verify-seed.ts`
  - Updated membership counts and now verifies the exact four organizer/reviewer memberships and roles.
- `apps/web/src/lib/auth.ts`
  - Removed the domain-suffix user-create hook that auto-enrolled new accounts into the demo organization.
- `apps/web/src/server-fns/organization.ts`
  - Activates a newly created organization before the onboarding wizard continues.
  - Allows staff to read organization settings while keeping every settings mutation admin-gated.
- `apps/web/src/routes/onboarding.tsx`
  - Parses boolean-ish `new` search input and bypasses existing-organization redirects for new-workspace setup.
  - Redirects only contact-fallback users from onboarding to their speaker portal.
  - Added role descriptions to the invite selector.
- `apps/web/src/components/org-switcher.tsx`
  - Uses TanStack Router to open `/onboarding?new=1`.
  - Shows organization settings to all organization members.
- `apps/web/src/routes/index.tsx`
  - Routes staff, including plain members, to admin before routing contact-only speakers to portal.
- `apps/web/src/components/app-sidebar.tsx`
  - Shows Overview to non-admin organization members in addition to My Reviews.
- `apps/web/src/components/app/admin-shell.tsx`
  - Mirrors the reduced Overview + My Reviews navigation in the command menu.
- `apps/web/src/routes/admin.evaluation.tsx`
  - Shows a genuine empty-assignment state for plain members; members promoted to event reviewer continue into the existing reviewer workspace.
- `apps/web/src/server-fns/portal.ts`
  - Uses a session guard for portal bootstrap.
  - Keeps real contacts on their normal portal and gives staff a representative-contact preview with an additive `preview` payload.
  - Leaves speaker mutations on their existing speaker guards.
- `apps/web/src/routes/portal.tsx`
  - Reads the preview payload and passes it to the portal shell.
- `apps/web/src/components/app/portal-shell.tsx`
  - Adds the slim preview strip with the representative name and a Back to admin link.
- `apps/web/src/components/app/user-menu.tsx`
  - Added explicit admin/portal context and the required Back to admin item for staff viewing the portal.
- `apps/web/src/components/site-header.tsx`
  - Shows View portal to all staff roles.
- `apps/web/src/components/organization/org-settings-dialog.tsx`
  - Added the three-line Owner/Admin/Member legend and inline descriptions to the invite role choices.
  - Existing member read-only behavior remains intact: invite UI is hidden, profile fields are disabled, and member/invitation controls are disabled.

No schema or migration files changed. No dependencies were added.

## Decisions and tradeoffs

- The checked seed gave every speaker an organization membership, which contradicted the brief's contact-only speaker authority and would send Maya, Lina, Jamal, Priya, and Marcus to admin under the required staff-first redirect. I changed the seed memberships, rather than weakening `roles.member` or changing redirect priority, because that preserves all stated role semantics and exercises the required zero-membership contact fallback.
- The brief named `events.listForAdmin`, but the dashboard had a second read-only event-role join that still rejected plain members. I removed that read guard as part of the specified member Overview access. Mutation guards remain unchanged.
- Plain members do not have an `event_members` row, while the reviewer workspace requires one. My Reviews therefore renders an empty assignment state until the member is assigned/promoted as an event reviewer; the existing reviewer flow is unchanged after that point.
- Preview selection prefers contacts with submissions, then uses a stable contact id order. This produces Maya Chen in the seed without hard-coding a persona id.
- The `new` search validator accepts `true`, `1`, `"1"`, and `"true"`; the switcher emits the requested `/onboarding?new=1` form.

## Verification

Passed:

- `pnpm check`
- `pnpm test` — 11 files, 41 tests
- `pnpm build`
- `pnpm --filter @opensesh/domain db:reset` — ended with `Seed verification passed`
- Direct domain smoke checks against `opensesh_wp25`:
  - Dana: admin/member, AI.Engineer event
  - Rey: reviewer/member, AI.Engineer event
  - Lina: contact-only speaker (`con_13`), AI.Engineer event
  - Priya: contact-only speaker (`con_devflow_priya`), DevFlow event
  - Fresh unknown user: `NeedsOrganization` / HTTP 428
  - Rey can read both organization events and load the dashboard.
  - Portal preview selects Maya Chen and returns two submissions.
- HTTP smoke checks on the local server: `/signup` returned 200 and unauthenticated `/` returned the expected redirect.
- `git diff --check`
- Confirmed no changes under `packages/domain/migrations/`.

## Manual test notes

The dev server started successfully at `http://localhost:3025`, but no controllable browser instance was available in this environment, so the visual/click-through walkthrough remains to be performed manually. Use the Demo roles button and verify:

1. Dana: `/admin` shows full admin navigation; View portal opens a Maya Chen preview strip; both the strip and profile menu return to `/admin`.
2. Rey: `/admin` shows Overview + My Reviews, both organization events are available, and View portal opens the same staff preview behavior.
3. Lina: `/portal` shows her real portal with no preview strip and no Back to admin item.
4. Organization settings: members can open it read-only; Members shows the role legend and invite choices show descriptions.
5. Create organization: use the switcher action, confirm the URL is `/onboarding?new=1`, complete the wizard, and confirm the new empty workspace is active while the original organization remains in the switcher.
6. Fresh signup: sign in with a new email and confirm it reaches Create workspace with no demo organization or event visible.

## Open items

- Only the browser walkthrough above is open because browser control was unavailable. Implementation, static validation, tests, build, local seed reset, and domain-level role/preview checks are complete.

## Commands and URLs

```sh
pnpm check
pnpm test
pnpm build
pnpm --filter @opensesh/domain db:reset
pnpm --filter web dev --port 3025
```

- App: `http://localhost:3025`
- Signup: `http://localhost:3025/signup`
- New workspace: `http://localhost:3025/onboarding?new=1`
