# WP24 report — organization onboarding and empty states

## What I built

- Replaced the global event-slug pin with organization-aware current-user resolution.
  - A valid Better Auth `activeOrganizationId` wins; otherwise the oldest organization membership is used.
  - The selected organization's next upcoming event is used, falling back to its most recent event.
  - Organizations with no events resolve to a nullable current event instead of crashing.
  - `NeedsOrganization` and `NeedsFirstEvent` are typed application states.
  - The seeded contest personas remain explicitly pinned: the regular demo personas use AI.Engineer and the four evaluator personas use DevFlow.
- Added self-serve magic-link signup at `/signup` and limited automatic demo-org membership to `@opensesh.io` and `@sbek-test.example.com` accounts.
- Added the focused `/onboarding` flow:
  1. create an organization with an auto-derived slug and optional fixed-key R2 logo;
  2. invite admin/member teammates, with skippable rows and captured demo invitation links;
  3. create the first event with name, type, timezone, and dates.
- Added Better Auth-backed organization creation and invitation server functions. Organization IDs use the `org_` prefix, Better Auth creates the owner membership and activates the organization, and accepted organization admins are materialized as event admins to preserve the event-plane authorization boundary.
- Added organization invitation mail rendering and demo-mode capture without adding a schema or coupling identity-plane invitations to an event email log.
- Added `/accept-invitation/$invitationId`, including magic-link sign-in, acceptance, active-organization selection, and designed expired/revoked handling.
- Extracted a reusable event creation form and used it in the event switcher, onboarding, and the `/admin` create-first-event state.
- Added the stock shadcn `Empty` primitive and designed empty states across every requested admin surface.
- Removed seeded event-ID assumptions from affected admin route preloads.

## Decisions and tradeoffs

- No Drizzle schema or migration changed. The existing Better Auth organization tables were sufficient.
- `CurrentUserValue.eventSlug` is nullable only for the legitimate organization-without-events state. Existing session/staff/admin/reviewer/speaker role checks remain centralized in `requireCurrentUser`; operations that require an event fail with typed `NeedsFirstEvent`.
- Event selection remains the existing local, instant sidebar selection. Organization resolution now controls which events are available, while server mutations continue receiving and authorizing explicit event IDs where required.
- Better Auth's organization API owns creation, invitations, acceptance, owner membership, and active-organization session updates. Direct Drizzle writes are used only in organization hooks for the sanctioned event-membership projection.
- Invitation mail is not inserted into the event-scoped `email_log`: an organization invitation may exist before the organization has an event. In demo mode the generated acceptance URL is returned to the onboarding UI instead.
- The Emil design-engineering guidance informed the focused page transitions and press feedback: transform/opacity-only motion, shared sub-300 ms curves, and reduced-motion support already provided by the project styles.

## Empty-state audit

| Surface | Route | Primary action |
| --- | --- | --- |
| Overview | `/admin` | Create call for papers |
| Call for Papers | `/admin/forms` | Create form |
| Submissions | `/admin/abstracts` | Create call for papers |
| Evaluation | `/admin/evaluation` | Create round |
| Sessions | `/admin/sessions` | Review submissions |
| Content | `/admin/content` | Review submissions |
| Speakers | `/admin/speakers` | Add speaker |
| Agenda | `/admin/agenda` | Review submissions |
| Widgets | `/admin/widgets` | Add widget |
| Tasks | `/admin/tasks` | Add task |
| Deliverables | `/admin/file-requests` | Add requirement |
| Files | `/admin/files` | Create deliverable |
| Portal Forms | `/admin/portal-forms` | New portal form |
| Email delivery | `/admin/emails` | Open communications |
| Communications | `/admin/communications` | Add speakers |
| Speaker CRM | `/admin/crm` | Add contact |

## Files touched

Domain and runtime:

- `packages/domain/src/server/current-user.ts`
- `packages/domain/src/server/errors.ts`
- `packages/domain/src/server/runtime.ts`
- `packages/domain/src/server/repos/events.ts`
- `packages/domain/src/server/mail.ts`
- `packages/domain/src/server/mail/templates.ts`
- `packages/domain/src/server/schema/core.ts`
- `packages/domain/src/server/schema/organization.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/server/runtime.ts`
- `apps/web/src/server-fns/admin.ts`
- `apps/web/src/server-fns/get-event.ts`
- `apps/web/src/server-fns/organization.ts`

Onboarding, invitation, and shell UI:

- `apps/web/src/routes/signup.tsx`
- `apps/web/src/routes/onboarding.tsx`
- `apps/web/src/routes/accept-invitation.$invitationId.tsx`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/admin.tsx`
- `apps/web/src/components/login-form.tsx`
- `apps/web/src/components/event-switcher.tsx`
- `apps/web/src/components/app/admin-shell.tsx`
- `apps/web/src/components/nav-main.tsx`
- `apps/web/src/components/events/create-event-form.tsx`
- `apps/web/src/routes/admin.settings.organization.tsx`
- `apps/web/src/routeTree.gen.ts`

Empty states and dynamic admin preloads:

- `apps/web/src/components/ui/empty.tsx`
- `apps/web/src/components/admin/admin-empty-state.tsx`
- `apps/web/src/routes/admin.index.tsx`
- `apps/web/src/routes/admin.forms.tsx`
- `apps/web/src/routes/admin.evaluation.tsx`
- `apps/web/src/routes/admin.$section.tsx`
- `apps/web/src/routes/admin.speakers.tsx`
- `apps/web/src/routes/admin.files.tsx`
- `apps/web/src/routes/admin.communications.tsx`
- `apps/web/src/routes/admin.portal-forms.$formId.tsx`
- `apps/web/src/components/review-desk/submission-table-page.tsx`
- `apps/web/src/components/admin/speakers-directory.tsx`
- `apps/web/src/components/agenda/agenda-page.tsx`
- `apps/web/src/components/admin/widget-builder.tsx`
- `apps/web/src/components/admin/portal-admin.tsx`
- `apps/web/src/components/admin/files-library.tsx`
- `apps/web/src/components/admin/email-viewer.tsx`
- `apps/web/src/components/admin/communications-page.tsx`
- `apps/web/src/components/crm/crm-workspace.tsx`

## Verification performed

- `demo@opensesh.io` signed in with `demo-pass-2027`; the `/admin` server-rendered bootstrap resolved `eventSlug: "ai-engineer-nyc-2026"` and displayed **AI.Engineer Sandbox — NYC 2026**.
- `jordan.organizer@sbek-test.example.com` signed in with its seeded evaluator password; the bootstrap resolved `eventSlug: "devflow-conf-2027"` and displayed **DevFlow Conf 2027**.
- A fresh arbitrary email completed the live magic-link callback, had zero inherited demo memberships, and reached **Create your organization**.
- That user created `WP24 Verification 1786426195059` as owner, invited a second fresh address as admin, created `WP24 Empty Event 1786426195059`, and reached `/admin`.
- The captured invitation link signed in the second fresh address, accepted the invitation, set the active organization, and loaded the same event in `/admin`.
- All 16 routes in the empty-state table returned successfully through the running app and contained their expected primary action. Evaluation's query is client-hydrated, so its server response was additionally checked for its loading boundary and the source for the final empty action.
- `apps/web/.dev.vars` remained on local `opensesh_wp24`; no schema, migration, or `DATABASE_URL` change was made.
- Passed:
  - `cd apps/web && pnpm check`
  - `cd packages/domain && pnpm check`
  - `pnpm vitest run` — 11 files, 41 tests
  - `pnpm build`
  - `git diff --check`

## Manual verification

Start only the local app:

```sh
cd apps/web
pnpm dev --port 3024
```

1. Open `http://localhost:3024/login`, sign in as `demo@opensesh.io` / `demo-pass-2027`, and confirm AI.Engineer is selected with seeded data.
2. Sign out, sign in as `jordan.organizer@sbek-test.example.com` with the seeded evaluator password, and confirm DevFlow is selected.
3. Open `http://localhost:3024/signup`, use a new arbitrary email, and click the demo magic-link button.
4. Complete organization creation, send an admin invitation, copy/open the captured demo invite, then create the first event and confirm `/admin` opens.
5. In a signed-out browser context, open the invitation link, request the invitee magic link, accept, and confirm the invited admin reaches `/admin` in the new organization.
6. Visit each route in the empty-state audit table and verify its icon, one-line explanation, and primary action.
7. To isolate the create-first-event state, stop after organization creation and open `http://localhost:3024/admin`; create the event from the full-page state and confirm the normal shell replaces it.

## Known gaps

- The in-app browser connection was unavailable in this agent session, so I could not complete a visual screenshot/click walkthrough. The flows were verified through the live port-3024 HTTP and TanStack server-function boundaries, but final visual QA should follow the manual steps above.
- The local verification database contains the fresh organizations/users created while exercising the requested onboarding and invitation flows; production was never contacted.
