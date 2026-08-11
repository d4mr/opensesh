# WP23 report

## What I built

- Added real `dnd-kit` CRM pipeline dragging between stage columns with the established pointer sensor, `pointerWithin` collision detection, composite IDs, stable `DndContext` ID, active-card overlay, origin-stage short circuit, and subtle column targeting state.
- Added an optimistic CRM workspace cache update with cancel/snapshot/rollback and settle invalidation. The existing Select + Move controls remain as the keyboard path, and moves still use the existing transactional server function that records stage history.
- Made Overview recent-submission rows navigate to the abstracts spotlight and agenda-day rows navigate to the agenda builder with the selected day in validated search state.
- Swept the remaining Overview lists: metric cards and needs-attention rows were already navigable; no additional dead list rows remained.
- Added Organization settings to the settings sidebar with profile editing, a dense member list, optimistic role changes/removals, pending invitations, and role-aware controls.
- Added Effect schemas, tagged organization errors, repository programs, repository layer wiring, server functions, and query wiring. Organization IDs always come from the authorized current-user context.
- Enforced owner/admin/member semantics in the repository. Last-owner changes/removal, sole-owner self-demotion, missing members, and unauthorized owner management are rejected server-side. Invitations are revoked by marking them canceled rather than deleting their audit record.

## Files touched

- `apps/web/src/components/crm/pipeline-board.tsx`
- `apps/web/src/components/dashboard-attention.tsx`
- `apps/web/src/components/data-table.tsx`
- `apps/web/src/components/nav-secondary.tsx`
- `apps/web/src/lib/organization-queries.ts`
- `apps/web/src/routes/admin.settings.organization.tsx`
- `apps/web/src/routeTree.gen.ts`
- `apps/web/src/server-fns/organization.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/server/errors.ts`
- `packages/domain/src/server/repos/index.ts`
- `packages/domain/src/server/repos/organization.ts`
- `packages/domain/src/server/runtime.ts`
- `packages/domain/src/server/schema/organization.ts`
- `REPORT-WP23.md`

`WP23-PROMPT.md` was already untracked and was not changed.

## Decisions and tradeoffs

- No database schema change was needed, so migrations were not regenerated.
- Cross-column cards append to the destination column because pipeline cards have no position field. Same-column drops do nothing locally, matching the server invariant.
- Drag feedback uses the existing 180 ms `--ease-out` curve convention for spatial continuity; the optimistic data move itself is immediate. No new motion dependency or animation system was introduced.
- The organization route uses the required event-admin server wrapper, then independently enforces organization roles in the repository. This keeps the client unable to grant itself organization scope or authority.
- Owners can manage all roles and the profile. Admins can manage non-owner members and non-owner invitations. Members receive read-only controls. The sole owner sees an inline explanation and disabled controls with a tooltip; the typed server guard remains authoritative.
- The seed contains two owners, Dana and Jordan. To verify the sole-owner invariant, I temporarily demoted Jordan, attempted Dana's self-demotion, observed the 409 guard, then restored Jordan. The final seed reset restored both owners.

## Verification completed

- `pnpm db:reset` — passed against only `opensesh_wp23`; 9 organization members and all seed expectations verified.
- Direct local repository role check — promoted Rey to admin, observed the persisted role, restored Rey, reduced the organization to one owner, and received `409 Add another owner before changing your role` on Dana's self-demotion. Final roles were restored.
- Direct local CRM persistence check — moved `crmcard_mei` from Contacted to Confirmed and observed its history count increase from 2 to 3. Ran `pnpm db:reset` afterward.
- `pnpm check` — passed, including the web package.
- `pnpm --dir apps/web check` — passed explicitly.
- `pnpm test` — 11 files and 41 tests passed.
- `pnpm build` — landing and full TanStack Start/Cloudflare web builds passed.
- `git diff --check` — passed.
- Dev server started successfully at `http://localhost:3023/` using the pinned port and local Hyperdrive connection.

## Left open

The in-app browser backend was unavailable in this session, so I could not truthfully complete the visual pointer/click walkthrough. The app-level behavior below remains for a short manual browser rehearsal; build, types, tests, local persistence, history creation, and authorization guards were verified.

## Manual verification

```sh
cd ~/work/personal/opensesh-wp23
pnpm db:reset
cd apps/web
pnpm dev --port 3023
```

Open `http://localhost:3023/` and sign in as Dana with `demo@opensesh.io` / `demo-pass-2027`.

1. Open `/admin/crm?tab=pipeline`, drag a card to another stage, reload, open the contact, and confirm the stage-history entry.
2. Open `/admin`, click a recent submission row, and confirm `/admin/abstracts` opens with that submission spotlighted.
3. Return to `/admin`, click an Agenda day row, and confirm `/admin/agenda` opens on that date.
4. Open `/admin/settings/organization`, change Rey between Member and Admin, reload, and confirm persistence.
5. For the sole-owner state, demote Jordan to Member. Dana's role and remove controls should become disabled with “Add another owner before changing this role.” Restore Jordan to Owner afterward, or run `pnpm db:reset`.

No commits, pushes, deploys, production database access, or migration changes were made.
