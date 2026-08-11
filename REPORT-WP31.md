# REPORT-WP31: Structural permissions refactor

## What changed

### 1. Derivation-based access (`packages/domain/src/server/current-user.ts`)
- `SessionIdentity` gained `name`; `CurrentUserValue` gained `name`, `orgRole`
  (`"owner" | "admin" | "member" | null`), and `events` (every org event with
  the user's explicit `memberRole: "admin" | "reviewer" | null`).
- New `requireEventAccess(eventId, required: "admin" | "reviewer" | "staff")`:
  admin = org owner/admin OR event-scoped member admin; reviewer = admin OR
  member reviewer; staff = any org member whose org owns the event. Returns
  `{ user, event: { id, slug }, admin }`. Recomputed per **target** event, so
  an event-scoped admin of event A can never act as admin of event B (this
  closes a latent hole: the old `requireManagedEvent` checked session-event
  roles against an arbitrary `eventId` parameter).
- Contact-only speakers get `orgRole: null, events: []` -- portal identity
  intact, zero staff access.
- `apps/web/src/lib/auth.ts`: deleted the `afterAcceptInvitation` fan-out that
  created `event_members` rows for every event on org join. `event_members` is
  now written only by explicit staffing flows.

### 2. Repositories stopped making access decisions
- `review-desk.ts`: dropped identity/slug params and all
  `organizationMembers`/`scopeMember` gate joins. Interface is now
  `list(eventId, kind)`, `detail(eventId, submissionId)`,
  `evaluationQueue(viewer: { userId; isAdmin }, eventId)`,
  `upsertReview(viewer, input)`, `changeStatus(eventId, submissionId, status)`,
  `decide(input)`. Deleted `eventSlugById`, `adminMembership`.
- `read-models.ts`: rewritten; `eventLibraryForAdmin`/`formSummariesForAdmin`/
  `formEditorForAdmin` take a bare `eventId` (-312 lines of duplicated
  membership plumbing).
- `portal.ts`: takes `PortalActor { userId; name }`; deleted `memberForAdmin`;
  history/comment/version authorship joins go straight to `users`.
- `crm.ts`, `speaker-comms.ts`, `reviews.ts`, `events.ts`: same pattern --
  callers pass `userId`; `createForAdmin` deleted (callers use `create`).
- `events.listAdmins` is the one derivation read model: union of org
  owners/admins and `event_members` admin overlay, deduped, sorted by name.

### 3. Attribution moved to `users.id` (schema + migration)
- Renamed and repointed to `users.id`:
  `submission_edit_history.author_user_id`, `.reviewed_by_user_id`;
  `contact_edit_history` same pair; `file_uploads.uploader_user_id`;
  `file_comments.author_user_id`; `crm_notes.author_user_id`;
  `crm_cards.owner_user_id`; `crm_card_history.actor_user_id`;
  `email_campaigns.created_by_user_id`; `ai_review_results.overridden_by_user_id`;
  `reviews.reviewer_id` (name kept, FK repointed to `users.id`).
- Kept `event_members.id` FKs only on roster tables: `reviewer_tracks`,
  `review_round_members`, `review_assignments`.
- Single flat migration regenerated:
  `packages/domain/migrations/20260811131544_stiff_norman_osborn/` (old
  `20260811125036_stormy_loners` deleted -- pre-launch flat-migration policy).

### 4. Server functions (`apps/web/src/server-fns/`)
- All event-scoped fns gate through `requireEventAccess` inside the effect,
  with the **outer** `runServer` gate at `{ require: "staff" }`. Rationale:
  the session-level `roles.admin` is computed for the session's active event;
  using it as the outer gate would wrongly deny an event-scoped admin whose
  request targets a different event. `requireEventAccess` is the real gate.
- `saveAdminSpeaker` now records `user.name` (was an email-prefix hack).
- CRM workspace response dropped `actorEventMemberId`.

### 5. Seeds
- `mem_dana` deleted -- Dana (org owner) is derived admin with zero
  `event_members` rows. Jordan demoted to org `member`, keeping only the
  `mem_jordan_devflow` event-admin overlay, so the persona actually exercises
  the overlay path. Reviews attributed to `usr_rey`; CRM actors to
  `usr_dana`; verify-seed expects 3 event_members.

## Decisions / deviations
- **`organizationMembers` still appears in a few non-listAdmins repo sites**:
  `portal.ts` `getVersionForActor` and `submissions.ts` dashboard queries use
  it for *org-tenant scoping* (is this user in the org that owns this event),
  not role gating; `reviews.ts` inserts org membership when inviting a
  reviewer; `organization.ts` is the org-membership repo itself. These are
  data-ownership checks, not access-decision duplication.
- **Outer gate `{ require: "staff" }`** on all requireEventAccess-gated fns
  (see section 4) -- deliberate.
- `verify-wp31-personas.ts` added under `src/seed/` as the persona proof
  harness (runs against the seeded DB with injected identities).

## Verification transcript (fresh `opensesh_wp31` database)

- `pnpm check` -- 6 pass lines:
  - pass: All 89 files are correctly formatted
  - pass: All 18 files are correctly formatted
  - pass: Found no warnings, lint errors, or type errors in 13 files
  - pass: Found no warnings, lint errors, or type errors in 87 files
  - pass: All 207 files are correctly formatted
  - pass: Found no warnings, lint errors, or type errors in 200 files
- `pnpm test` -- Test Files 12 passed (12); Tests 44 passed (44).
- `pnpm db:reset` -- ends "Seed verification passed: DevFlow fixtures,
  personas, review rounds, CRM, status mix, one conflict, and org memberships."
- `pnpm seed:verify` -- passed (same line).
- `pnpm review-desk:verify` -- "Review desk verification passed: 4 of 7
  reviewed; accepted SESS-2 (7 tasks, 2 emails); declined SESS-10, SESS-9."
- `pnpm cfp:verify` -- "CFP integration verification passed."
- `pnpm mail:verify` -- "Mail verification passed: 14 calendar invites, 15
  task reminders." plus "Failure isolation passed".
- Persona proofs (`node --env-file=../../apps/web/.dev.vars --import tsx
  src/seed/verify-wp31-personas.ts`) -- 15/15 ok:
  - Dana (org owner, zero event_members rows): devflow admin allowed; desk
    list/detail work; appears in `listAdmins` alongside Jordan; orgRole owner.
  - Jordan (org member + devflow event admin): devflow admin allowed; **aie
    admin DENIED (Forbidden)**; aie staff allowed; orgRole member.
  - Rey (reviewer overlay on aie): reviewer allowed, admin denied; evaluation
    queue track-scoped to Agents + Evals & Observability.
  - Maya (contact-only speaker): portal identity intact (contactId=con_01,
    orgRole null); staff access denied.
- Greppable invariants:
  - eventMembers.role "admin" comparisons: only
    `packages/domain/src/server/repos/events.ts` (listAdmins overlay).
  - memberForAdmin / adminMembership / eventSlugById: no matches.
  - createForAdmin / requireManagedEvent: no matches.
  - organizationMembers in repos: events (listAdmins), organization (org
    repo), portal/submissions (tenant scoping), reviews (reviewer-invite
    insert) -- see deviations above.
- LOC sanity: `git diff --shortstat HEAD` = 39 files, +1015 -14799 overall;
  access-logic surfaces (`packages/domain/src/server` +
  `apps/web/src/server-fns`) net **-517** lines.

## Open items
- None functional. Follow-up candidates: `roles.admin/reviewer` on
  `CurrentUserValue` are now derivable from `orgRole` + `events` and could be
  removed once UI callers migrate; portal/submissions tenant-scoping joins
  could move behind a shared helper.
