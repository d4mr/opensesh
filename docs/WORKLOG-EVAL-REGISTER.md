# Working log — eval register clearance + permissions/widget arc

Started 2026-08-11 (night). Goal: clear docs/EVAL-ISSUE-REGISTER-2026-08-11.md + permissions
rethink + widget editor UX. Register findings are NOT treated as golden — every item gets a
verification verdict before work is scheduled.

Baseline commit: `9595069` (polish batches 4-6). No git remote; prod (opensesh.io) still on the
morning deploy — everything here ships in the next deploy.

## Verdict legend

- **confirmed** — reproduced locally or verified in source
- **refuted** — eval finding is wrong / already fixed; evidence noted
- **accepted-gap** — real but deliberately out of scope for the contest window (reason noted)
- **fixed** — fix landed on main (commit noted)

## Arc A — Permissions model (user directive + OS-001/OS-002)

- [ ] Plan-agent design for roles/visibility model (owner? admin portal access? event visibility)
- [ ] Workspace settings surface for roles
- [ ] Portal↔admin switching (View portal for admins + Back to admin in profile menu)
- [ ] OS-001 signup lands in seeded portal (P0)
- [ ] OS-002 create organization no-op (P0)

## Arc B — Widget editor UX (user directive + OS-031/032/033/034/035/049/050)

- [ ] Split scroll panes (controls left, preview right, independent)
- [ ] Get code → editor top nav
- [ ] Register widget items (verify first)

## Arc C — Register triage

| ID | Verdict | Disposition | Notes |
|---|---|---|---|
| OS-001 | confirmed | codex WP25 | Root: keepsDemoMembership hook in lib/auth.ts auto-enrolls ANY new @opensesh.io/@sbek-test signup into the seeded demo org as member → skips NeedsOrganization → bounced to seeded portal Forbidden. Fix: delete the hook (personas are properly seeded) + onboarding beforeLoad fallback. |
| OS-002 | confirmed | codex WP25 | Org-switcher "Create organization" → /onboarding whose beforeLoad bounces has-org users back to /admin. Fix: ?new=1 search param + setActiveOrganization after create. |
| OS-003 | confirmed | FIXED (WP28, browser-verified locally) | participantForEmail hardcoded role:"speaker"; DevFlow roles now threaded through the wizard (role-labeled speaker cards) + server-side coercion. Acceptance walked end-to-end: Primary speaker + Co-presenter submission succeeds, SESS-6 pending in admin desk. Prod verification pending deploy. |
| OS-004 | confirmed | codex WP28 | Introduced by 06ae18d: Effect.all concurrency 2 for form update + replaceFields, AND replaceFields itself concurrent upsert+prune on different pool connections. Fix: one saveWithFields db.transaction (duplicate() at repos/forms.ts:121 is the house pattern). |
| OS-005 | symptom confirmed, cause REFUTED — real cause found | codex WP28 | NOT seeded twice: formEditorForAdmin cross-joins fields × event admins and never dedups fields (read-models.ts:147); org has 2 owners → every field renders twice → duplicate ids → ON CONFLICT 21000 → OS-004's toast + OS-006's lost edits. THE highest-leverage fix in the register. Also: createForm seeds no Description field — add canonical one. |
| OS-006 | first half confirmed (via OS-005), toggle half uncertain | codex WP28 | Type select handler is correct; persistence fails (dup ids) + no invalidation after save (staleTime 30s resurrects stale fields) + fieldId falls back to section-position → React key collisions. Fix: OS-005 + mint UUIDs + invalidate after save. |
| OS-007 | confirmed (mechanism corrected) | codex WP28 | No publish validation at all; DevFlow form has min-1 participant role with ZERO participant fields. General defect: upsertParticipants silently DROPS participants with no email answer. Fix: open-status validation + loud InvalidInput + seed participant fields. |
| OS-008 | confirmed (DevFlow seed only) | codex WP28 | seed.ts:242 gives richtext 255 chars (only textarea gets 5000); limit measured on raw HTML incl. tags. Fix: explicit maxChars in seed + strip HTML before length check. |
| OS-009 | confirmed | fix inline | All 136 server-fns funnel through runtime.ts runServer/runSessionServer; toServerError already computes status. Fix: setResponseStatus at the 2 wrapper returns, guarded to /_serverFn path (SSR shares h3 event — status would bleed into document response; loaders use 428/403 as redirect signals). |
| OS-010 | confirmed | fix inline | DbError captures cause but nothing reads/logs it; zero server-side logging (the handler's console.error is dead — toServerResult never throws). Fix: tapError log in repos/shared.ts query() (352 sites untouched) + cf-ray annotation at composition root. wrangler.jsonc lacks observability block — enable. |
| OS-011 | partially fixed | fix inline (4 spots) | Timestamp pass fixed most. Remaining: (1) sidebar cookie read via document → SSR always "expanded" (thread through server context), (2) CFP wizard restores step from localStorage in useState initializer → different subtree (effect+ready flag), (3) create-event-form browser-tz + Date.now in render, reachable SSR via admin.tsx zero-events state, (4) latent Math.random in unused SidebarMenuSkeleton (delete). Calendar primitive unpinned locale = client-only today, pin anyway. |
| OS-012 | refuted as stated | codex WP29 (adjacent bugs) | Mutation invalidates + awaits the exact query. Real adjacent bugs: auto-distribute plans 0 for non-pending subs then toasts success; assign returns requested not created count; accepted rows vanish making counts disagree (=OS-014). |
| OS-013 | confirmed | codex WP29 | Two disjoint review stores: spotlight counts legacy `reviews` table; round reviews live in reviewAssignments/reviewAnswers; submitAnswers never writes legacy. Fix: union round-completed counts into review-desk detail/list. |
| OS-014 | confirmed (filter is on KIND not status) | codex WP29 | Accept rewrites kind→"session"; evaluation workspace loads kind="abstract" only (reviews.ts:358) while the desk deliberately uses isNotNull(sourceFormId). Fix: mirror the desk predicate + status badge in Results. |
| OS-015 | refuted on both halves | codex WP29 (sharpen) | Toast exists + emailLog row exists (visible under Emails, not Communications). Sharpen: return queued/sent/failed and error-variant toast when failed>0. |
| OS-016 | confirmed | codex WP29 | decision-dialog picks speakers[0] from a Map in row-arrival order; participants' role/position never selected/ordered. Fix: select+order by position, prefer /primary/i role, widen "previewing first recipient" note to any multi-speaker. |
| OS-017 | premise confirmed, "silent" refuted | fix = configure prod key + WP29 gate | Failure is explicit and honest (documented behavior). Agenda has deterministic fallback; review doesn't. Plan: set ANTHROPIC_API_KEY in prod at deploy (user action), gate the button on aiConfigured flag; check model alias validity. |
| OS-018 | confirmed | codex WP30 | Parser fabricates values for absent columns (speaker-csv.ts:88 — "" and absent indistinguishable; dietary→"none") + repo writes every field unconditionally (widgets.ts:644 onConflictDoUpdate). Fix: UndefinedOr schema, absent→undefined, spread-filter the set object. |
| OS-019 | confirmed (seed part refuted) | codex WP30 | No speaker/organizer discriminator on contacts at all; every event contact IS a speaker to roster/tasks/comms. Blank contact came from CRM CSV import (zero name validation) then promoted via addToEvent/campaign (role hardcoded "speaker"). Jordan is NOT seeded as a contact. Fix: contacts.role column (schema) + import validation + filters. |
| OS-020 | confirmed at eval build; FIXED at HEAD | residuals → WP30 | Write path was always correct (noon event-tz anchor); render was browser-local pre-9595069, now pinned via Timestamp. Residuals: 4 seeded due dates are midnight-UTC (render a day EARLY in NY) → re-anchor to noon; reminder emails format in UTC (mail-admin.ts:307) → event tz (also in WP26 brief). |
| OS-021 | largely refuted | small surface fix (inline queue) | Editable "Travel and logistics" textarea EXISTS (Edit dialog, persists to contacts.custom, survives CSV). Eval never opened Edit. Real gap: spotlight shows dead-end "No travel or logistics notes" with no affordance + no portal self-serve. Fix: inline-edit affordance at speakers-directory.tsx:901. |
| OS-022 | confirmed | inline queue | Complete/incomplete split EXISTS now (directory taskFilter). Missing: per-template "who hasn't done X". Fix: taskTemplateId select next to outstandingOnly in AdminTasks + scope bulk reminder. Data already client-side. |
| OS-023 | confirmed gap | codex WP27 | Model already supports manual sessions (kind="session", sourceFormId null lands in Sessions desk; Submissions.create is dead code ready to use). Add-session dialog on sessions desk + SpeakerPickerDialog; replicate speaker-required invariant; check autoAssignOnAccept skip. No schema change. |
| OS-024 | confirmed | codex WP27 | portal-tasks renders data.tasks only; requirements never referenced. Unify: tasks ∪ (accepted submissions × requirements) with SessionFileRow upload mutation + FileThread; add file count to home Tasks card. No schema change. |
| OS-025 | confirmed (by design, spec 10-session-assets) | codex WP26 | No assignment table; file_uploads unique(submission,requirement) IS the slot; upload lookup drops contact predicate → speaker B appends to A's row. Fix: session_file_requirement_assignments table + scope on requirements + repoint uploads; materialize on accept/participant-change. SCHEMA CHANGE (flat migration regen). |
| OS-026 | confirmed | codex WP26 | portal-admin counts distinct submissionIds "N of M sessions uploaded" — unit can't represent per-speaker obligation. After WP26 model: count assignments, noun switches by scope. |
| OS-027 | confirmed gap | codex WP26 | No remind-outstanding anywhere; files-library selection restricted to UPLOADED rows (opposite set). Reuse queueTaskReminders shape in mail-admin.ts + email_log; "Remind outstanding (N)" on deliverables rows + files toolbar. Recipients only correct after per-speaker model. |
| OS-028 | REFUTED as filed | fix 2 sub-gaps | Approval gate EXISTS at all public query boundaries (widgets.ts publicSubmissionVisible + SQL gates + agenda.public filter; landed d2e8f95 — likely post-dates the eval's prod build). Real gaps: (a) no "N placed · M withheld pending approval" preflight at publish (setPublication bakes everything, read-time filter hides silently); (b) speaker edit → pending_review makes a LIVE session vanish (approvedSnapshot fallback is dead code because SQL filters pending rows). Fix: publish preflight count + backfill approvedSnapshot on pending transition so last approved revision stays live. |
| OS-029 | confirmed | fix (data-driven increment) | Hard 15-min increment at schedule.ts:54 + separate 15-min wall-clock rule :65-76 + solver SLOT_MINUTES=15; library allows any duration (default 30, input min=1). Fix: increment = clamp(gcd(format durations),≥5) threaded into validateScheduleChange + solver. |
| OS-030 | confirmed | fix with OS-029 | isCandidateLegal discards validation reason (solver.ts:164); one unplaceable session → null → generic "not enough legal slots". Fix: return reasons, preflight per-session validateScheduleChange in generateDraft before LLM call, name sessions+reasons. |
| OS-031 | confirmed | FIXED (this session) | Get code moved from footer (under the fixed demo-roles button) into the EditorHeader top bar as a dialog. |
| OS-032 | confirmed gap | inline queue (JSON+ICS) | Embed outputs limited to URL+iframe. Plan: /embed/$id.json + /embed/$id.ics server routes reusing publicWidget + existing ICS builder; add rows to Get-code dialog. |
| OS-033 | mechanism refuted; adjacent bug fixed | FIXED (this session) | Preview iframe is param-driven (live). Real loss mechanism: 400ms debounced autosave dropped on unmount — now flushed on unmount. Days filter was never persisted at all (dayKeys local state) — now in WidgetOptions (JSON, no migration). |
| OS-034 | root-caused | FIXED (this session) | Same lost-debounce mechanism (close within 400ms of color change). Flush fixes it. |
| OS-035 | confirmed | FIXED (this session) | sessionCount() pluralizer at the 3 unpluralized sites in program-views. |
| OS-036 | mechanism uncertain | HARDENED (this session) | mineOnly now persisted per event in sessionStorage — any remount preserves the active My Schedule tab. |
| OS-037 | refuted-as-written | fix adjacent bug | Enroll dialog DOES close+invalidate (pipeline-board.tsx:398). Real bug found instead: AddCardDialog contact/stage state computed at first mount, never reset — second open renders blank contact but submit still fires saveCrmCard for the ALREADY-enrolled prior contact (silently moves its stage/overwrites note). Fix: remount dialog on open + validity guard. |
| OS-038 | refuted | a11y follow-up FIXED (night note below) | Reset-mechanism doesn't fire (`useEffect` deps on string `card.stageId`); Move button works. Salvageable finding: dnd has PointerSensor only — no KeyboardSensor; drag handle doubles as open-contact button. Rescoped to P3 a11y → landed: KeyboardSensor + dedicated drag-handle button, browser-verified both directions. |
| OS-039 | confirmed (worse than filed) | fix | Copy is ACCURATE — sendCrmCampaign hardcodes addToEvent(role speaker, status invited) per recipient (server-fns/crm.ts:315). Worse: upsert conflicts on contactId ALONE, so emailing about Event B RE-POINTS an existing Event A link. Fix: conflict on (contact,event) + explicit opt-in checkbox in CampaignDialog. |
| OS-040 | confirmed gap | deferred | No score column on crm_pipeline_cards. Register itself ranks this behind everything; skip for contest. |
| OS-049 | confirmed gap | FIXED (night note below) | Was accepted-gap; shipped: per-widget Custom CSS (documented os-* selector API), live preview apply, rendered-HTML viewer. Prod verification pending deploy. |
| OS-050 | confirmed gap | accepted-gap | Search/filter on a ≤handful widget list is speculative depth; register agrees ("defer until realistic volume"). |
| OS-051 | confirmed gap | FIXED (383584b, browser-verified) | Top-companies + tags panels on CRM Overview, strip-header list style; rows drill through to the directory pre-filtered via a one-shot prefilter handoff (same remount pattern as the return path). |
| OS-052 | REFUTED — fixed locally pre-eval-register (9595069 SpeakerPickerDialog subset assignment) | residual → WP30 | autoAssignOnAccept (default true) re-widens a narrowed subset on accept (portal.ts:2292) — disable/hide the switch when a strict subset is picked. |

(OS-041..048 are eval-process limitations, not product defects — out of scope.)

## Timeline

- 23:xx — committed batches 4-6 checkpoint (9595069); register read; triage begins.
- +1h — triage complete (7 verification agents, all 44 product rows verdicted). Permissions plan
  designed (no schema change needed). Codex fleet dispatched: WP25 permissions/OS-001/002,
  WP26 per-speaker deliverables (schema), WP27 add-session + portal task unification,
  WP28 CFP integrity chain, WP29 evaluation correctness, WP30 contact/CRM integrity (schema).
- Inline (verified in browser): widget editor rebuilt — EditorHeader + Get code dialog top-right
  (OS-031), independent scroll panes, days filter persisted into WidgetOptions (new bug found:
  was never persisted), debounce flush on unmount (OS-033/034 root cause), pluralized counts
  (OS-035), itinerary view persistence (OS-036). NEW: Demo roles switcher no longer renders
  inside /embed (was shipping demo chrome into customer embeds). OS-009 truthful HTTP statuses
  at the single server-fn boundary (path-guarded against SSR bleed) + OS-010 DbError cause
  logging in repos/shared.ts + wrangler observability enabled.
- Aug 11 late — WP25/27/29/28 merged (zero-conflict), checks pass, browser-verified: portal
  preview strip + Back-to-admin, member nav, contact-only portal, sessions-desk Add session.
- Aug 11 night — OS-003 P0 acceptance CLOSED locally: full DevFlow wizard walkthrough as Dana
  (draft resume, autosave, role-labeled Speakers step) → 1 Primary speaker + 1 Co-presenter →
  "Submission received"; DB shows SESS-6 pending with both roles; row visible in DevFlow admin
  submissions desk. Two bugs found en route: (a) signed-out Continue was a silent no-op
  (save() returned null with no feedback) — fixed: routes to the Account sign-in step (ab68821);
  (b) org OWNER Dana got "You cannot manage these submissions" on DevFlow — the WP25 model says
  org owner/admin ⇒ admin on every event, but repos re-derive access via strict event_members
  joins, and event_members.id doubles as the attribution FK. Root cause: access derived in two
  places + drift-prone membership fan-outs (createForAdmin, afterAcceptInvitation).
- Aug 11 night — WP26 (deliverable assignments) + WP30 (contact/CRM integrity) merged; one
  conflict each (upload-button extraction vs assignment-status variant; reminder timezone),
  flat migration regenerated (20260811125036_stormy_loners), inArray import fixed, 6/6 checks,
  44 tests, seed verification passed.
- Aug 11 night — permissions refactor planned (Fable Plan agent) and dispatched to a Fable
  implementation agent (worktree, DB opensesh_wp31): pure derivation — requireEventAccess as
  the single gate in current-user.ts; repos drop access joins (net-LOC negative); attribution
  columns move event_members.id → users.id (reviews.reviewer_id repointed); reviewer-staffing
  tables keep member ids; createForAdmin/afterAcceptInvitation fan-outs deleted; seed demotes
  Jordan to org member (event-admin persona); listAdmins = org admins ∪ overlay admins.
- Aug 11 night — WP31 permissions refactor MERGED (bd8af45, agent commit 0c10dac): pure derivation
  landed. requireEventAccess in current-user.ts is the single gate (per-target-event recompute);
  repos take pre-authorized ids — memberForAdmin/adminMembership/eventSlugById/createForAdmin and
  every roster gate join deleted; attribution FKs moved to users.id (reviews.reviewer_id repointed);
  reviewer-staffing tables keep member ids; afterAcceptInvitation fan-out deleted; listAdmins =
  org admins ∪ overlay (single derivation read model); flat migration 20260811131544. Verified on
  main: 6/6 checks, 45 tests, seed + persona proofs (15/15: Dana admin everywhere with zero roster
  rows; Jordan devflow-admin/aie-staff-only; Rey track-scoped reviewer; Maya contact-only), browser:
  Dana on DevFlow desk lists 4 submissions and Tasks shows the empty state (both previously
  Forbidden). docs/DESIGN.md gained §8 Permissions. Net −517 LOC of access logic.
- Aug 11 night — user-directed CRM polish: multi-tag filters widen (any-of, was intersecting to
  zero), active-segment bar fully framed, company/title filters became EntityCombobox search
  pickers (capped async resolver). All browser-verified.
- Aug 11 night — settings surface polish + event access management (user-directed): event-settings
  and library pages got real scroll containers (a fixed-height grid distributes auto rows to fit
  and clips sections — scroll wrapper and layout grid are now separate elements); members dialog
  reserves the trash slot instead of rendering disabled ghosts. New Event settings → Access
  section: Events.listAccess/grantAdmin/revokeAdmin expose the WP31 derivation read model — org
  owners/admins listed as derived (managed in org settings), event-scoped admins grantable from
  org members and revocable (revoke demotes to reviewer when review staffing references the row,
  else deletes), reviewers shown read-only. Cross-link help text in both org Members dialog and
  the Access section. Browser-verified grant (Rey), promote-reviewer + demote-on-revoke (Sam),
  plain revoke; 6/6 checks, 45 tests.
- Aug 11 night — settings-page scroll model redone per user feedback: the outer page was gaining
  ~600px of phantom scroll on event settings only — Radix renders a hidden absolutely-positioned
  native <select> beside each in-form Select, whose containing block skipped the non-positioned
  scroll container and resolved to the relative shell <main>. Fix + rework: event settings now has
  a pinned toolbar (title + dirty-gated Save that rests as "✓ Saved", rebaselined via
  formApi.reset after save) above one scrolling content region (`relative` so the hidden selects
  stay contained); library page scrolls whole-pane, title included. Members dialog trash now
  floats in the gutter outside the row (absolute, hover-revealed) so role selects sit flush right.
  All browser-verified.
- Aug 11 night — user-directed polish round 2: (1) RTE link button fixed — integrated agent
  worktree claude/ecstatic-darwin-55f3fd replacing window.prompt with a popover URL input
  (https default, extendMarkRange, Remove action, bounded focus claim); verified link applies.
  (2) Content page Accept button size sm→xs (h-6) to fit the h-9 rows. (3) Speaker spotlight
  de-HR'd to the session-peek grammar: SectionLabel drops uppercase/tracking, every list
  (readiness, sessions, tasks, files, emails, profile history) moved from edge-to-edge border-y
  hairlines into rounded bordered cards with px-3 rows + hover states; contact/bio hairlines
  removed; "Edit speaker/Edit speaker" label-button dedup → "Profile [Edit]".
- Aug 11 night — Content table: code em-dash pattern replaced with an outline code badge +
  regular space (the table keeps its single Session column; desk tables keep their separate
  font-mono Code column); status filter added to the header (All/Pending/Accepted, hidden when
  there is no content), filtered-empty table row, pagination follows the filter. Verified:
  Pending shows 11/11 on the sandbox event.
- Aug 11 night — OS-049 widget Custom CSS + rendered-HTML viewer: WidgetOptions grew
  `customCss` (optionalKey; added to repos/widgets.ts normalizeOptions, which rebuilds options
  field-by-field on read and silently drops unknown keys). Embeds render saved CSS in a
  `<style>` tag (`</style` neutralized); the builder gained a Custom CSS field with the os-*
  selector guide (program-views.tsx classes are now a documented embed customization API — see
  the comment above TrackChip) and a View HTML dialog: markup shown instantly as plain mono
  text, shiki (lazy `shiki/bundle/web`, dual github themes) swaps in with a real byte-progress
  readout from PerformanceObserver resource entries; failure falls back to plain text + Retry.
  Three real bugs found while landing it: (1) `prettyHtml` used `instanceof Element` on nodes
  from the preview iframe's realm — always false cross-realm, so the snapshot was always empty
  and the old dialog hung on "Loading" forever (nodeType check now); (2) the module-level shiki
  promise cached rejections (dev-server dep re-optimization) so one failed import bricked the
  viewer for the session (cache cleared on failure now); (3) dialog restyled to the email-viewer
  grammar (p-0, bordered text-base header, size-xs toolbar buttons) per user feedback.
- Aug 11 night — live preview rebuilt on postMessage (user-reported staleness + flicker): the
  old iframe src was rebuilt per keystroke from URL params, but parseWidgetSearch was not
  idempotent under TanStack Router's serialize→re-parse round trip (arrays re-enter as JSON
  arrays, "0"/"1" as numbers, "default" color as null — all degraded to undefined on the second
  validation pass), so every override silently fell back to the widget's SAVED options; the
  preview only "worked" via the 400ms autosave writing to the DB before the reload, and rapid
  filter toggles left it stuck on stale state. Fix: (1) parsers accept both raw and round-tripped
  forms (csv takes string or array, bool takes "0"/"1"/0/1/booleans) so shared embed URLs with
  params now actually work on fresh loads; (2) the builder preview no longer depends on any of it
  — the iframe stays on a stable `/embed/{id}?preview=1` URL and receives the live draft (view,
  name, options incl. customCss) via same-origin postMessage with a ready handshake, so edits
  apply with zero reloads (no flicker), zero dependence on autosave timing. Autosave still runs
  in the background. Browser-verified: rapid Keynote+Talk toggle+untoggle ends at 11/11 with 0
  iframe reloads; filter applies live (2/2); CSS applies live; Share URL with formats param
  filters correctly on fresh load; shiki dark/light both render.
- Aug 11 night — OS-038 salvaged a11y landed: pipeline board gained KeyboardSensor with a custom
  coordinate getter (ArrowLeft/Right jump between stage columns by sorted column rects), a
  pointerWithin→rectIntersection collision fallback, and a dedicated drag-handle button (grip,
  focus ring, aria-label "Drag X to another stage") separate from the open-contact button.
  Browser-verified: Enter → ArrowRight → Enter moved Elena Petrov Prospect→Contacted (announced
  via live region + "Moved Elena Petrov to Contacted" toast), and the reverse restored her.
- Aug 11 late night — V2 register P0 arc (screenshot-verified locally, per new validation rule:
  every repro and fix is confirmed against rendered screenshots, not the accessibility tree).
  V2-004: CFP wizard treated localStorage draft state as truth after a DB reseed — blank Review
  step and "cannot edit" walls. Structural fix: client state is now only a cache hint; the loader
  self-heals on 404/403 (clears stale draft id/answers, clamps the restored step), saveDraft
  distinguishes NotFound (stale/not-owned → heal + retry as insert) from Forbidden (decided →
  portal message), updates preserve status/submittedAt, and "Start a submission" explicitly
  resets to fresh. Also fixed silent data loss: custom answers whose mapsTo isn't a real column
  (e.g. notes_for_reviewers) now land in the answers jsonb instead of being dropped.
  V2-001: event creators had no access to their own event (pure-derivation model left no
  event_members row). Fix keeps derivation pure and adds the invariant that creating an event
  writes the creator's admin member row in the same transaction (API-key creations pass null).
  V2-024: acceptance no longer implies publication. CFP submissions are born
  contentReviewStatus=pending_review; decide() gained an explicit approveContent flag (decision
  dialog checkbox, default off, "Also approve content for publication"), re-approval only
  auto-restores when a prior approvedSnapshot exists; manual/API sessions stay approved-on-create
  (organizer-authored). Content dashboard now shows a Content column (Approved / Awaiting
  approval / Changes pending), a "N accepted sessions are not public yet" banner with Approve
  all, and per-row Approve wired to a new approveSessionContent portal fn that also resolves
  pending edit-history rows. Seeds align with the model (only accepted rows approved+snapshot).
  Verified end-to-end on AIE: accept w/o checkbox → pending_review; scheduled + republished
  agenda still hides it publicly (8 of 8); Content approve → toast → public 9 of 9 with the
  session card rendered; accept with checkbox → approved immediately with snapshot.
- Aug 11 late night — V2-002/003/007 CFP runtime (screenshot-verified): V2-002's React #418
  was the wizard's useState initializers reading localStorage during the hydration render —
  SSR said Welcome, the client's first render said whatever step was stored, and React's
  recovery left a blank Review. Structural fix: step/submissionId/maxStep now start
  deterministic (0/null/0) and a mount effect restores the persisted position, clamped to the
  Account step when there is no draft or no signed-in account. Verified: reload with draft+step
  stored restores Proposal with saved answers and adds zero hydration errors; logged-out with a
  stale step=4 key lands on Account, not a blank Review. V2-003 (conditional fields) and V2-007
  (stray "Event not found") reproduce only against stale prod: locally the builder saves the
  Format=Workshop condition ({fieldId, operator, values:[format id]} confirmed in DB) and the
  public renderer hides/reveals Workshop prerequisites correctly for none/Talk/Panel/Workshop;
  no stray text renders on any valid step. Both ride the pending deploy.
- Aug 11 late night — V2-005/006/022/026 identity enrichment (Fable consult + screenshot-verified):
  root cause was three independent clobbering writers of event contacts. Landed the consult's
  B-lite design: one pure two-mode policy, enrichContact(existing, incoming, mode) in
  packages/domain/src/server/contact-enrichment.ts — empty (null/""/[]) incoming values never
  write; fillBlanks (CFP updates, CRM copy-on-link) only fills empty existing fields; 
  preferIncoming (CSV update rows) overwrites with non-empty values only; custom jsonb always
  merges per key so one form can never wholesale-replace another's answers. Wired into: CFP
  upsertContact (participation stays an explicit workflow write), CRM addToEvent (clobbering
  onConflictDoUpdate replaced by read-merge-write in the same transaction = copy-on-link
  hydration, so CRM edits after linking never silently rewrite event pages), and CSV
  importSpeakers (blank cells ≡ absent columns via present()). Portal/admin editors keep full
  overwrite — the only places deliberate clearing belongs. V2-006: Biography (textarea, maps_to
  bio, optional) added to default participant questions and the seeded DevFlow CFP; the wizard
  prefills it from the contact. Verified in browser: Priya submitted a new proposal with
  Biography cleared → portal still "Profile ready", bio intact in DB; sparse co-speaker Casey
  created via CFP (bio null) → CRM contact added with rich bio → "Add to event" hydrated
  title/company/bio onto the existing sparse event contact. V2-026 needs no further product
  change: sparse CSV now provably cannot erase, and low readiness from truly-absent data is the
  rubric's own expectation.
- Aug 12 — V2-018 10-minute lightning scheduling (screenshot-verified): the 15-minute rule was
  enforced twice — the popover's static duration list had no 10 (blank SelectValue), and domain
  validateScheduleChange rejected non-15 durations AND non-15 end minutes. Resolution follows
  calendar convention: starts stay snapped to the 15-minute planning grid; durations belong to
  the session's format in 5-minute steps, so end times may sit off-grid (validation now checks
  duration % 5 and end minute % 5, start still % 15). The popover duration list is the union of
  grid steps + the session's own durationMinutes + its current value. The rooms grid already
  renders proportionally and the AI solver already emits start+trueDuration, so both are
  consistent with the relaxed rule. Verified: accepted DevFlow SESS-4 (Lightning, 10 min) →
  popover preselects "10 minutes" → saved May 12 9:00–9:10 Main Stage (DB 10.0 minutes) →
  rooms grid renders the partial-height block.
- Aug 12 — V2-023 (screenshot-verified): "Also add recipients to event" in the CRM campaign
  composer now defaults OFF — enrolling recipients as invited speakers is an explicit opt-in,
  and the success toast states the side effect ("Sent N emails and added N recipients to the
  event") when it was chosen. Dialog description already flips between the two behaviors.
- Aug 12 — V2-008/019/025/027 stale mutation surfaces (screenshot-verified): only V2-019 needed
  new code — the agenda rooms-view peek dialog held the session OBJECT in state, freezing the
  open dialog on pre-mutation data; it now stores the id and derives the row from live agenda
  data (schedule change with the dialog open updates its time in place, verified 9:00→10:00).
  V2-008 (assignments) and V2-025 (session content block + version history) were re-verified
  live against current code — assignment flips the tab to (1) and the row to "Sam Whitfield ·
  pending" instantly; save-and-approve updates header, block, status, and Content history (1
  version) with no reload — their invalidations landed in the wp27–29 arcs and the eval saw
  stale prod. V2-027 (CRM add-to-event feedback) verified during the V2-022 pass: the linked-
  events list updates immediately after Add to event.
- Aug 12 — V2-010/011/021 observable feedback (screenshot-verified): silent fire-and-forget
  actions now always answer. V2-011 CSV exports (review-desk table shared by Submissions and
  Sessions) toast "Exported N rows to <kind>s.csv" after the download anchor fires. V2-021 the
  public program's ICS/agenda downloads surfaced neither failure nor success — both now toast
  the error message on a failed server fn and "Downloaded <filename>" on success. V2-010
  needed no change: evaluation reminders already report Sent/Failed/none counts and assignment
  saves invalidate the round query (wp29). Verified: DevFlow Sessions → Export CSV →
  "Exported 1 row to sessions.csv"; AIE public itinerary → star SESS-16 → Export ICS →
  "Downloaded ai-engineer-nyc-2026-my-schedule.ics".
- Aug 12 — Rich text is now stored as markdown (owner decision, structural): TipTap keeps the
  editing UX but persists editor.getMarkdown() via the first-party @tiptap/markdown extension;
  the only render path is <RichText markdown=…> → packages/domain/src/rich-text.ts →
  markdown-it with html:false (author HTML renders as literal text, so stored XSS is
  inexpressible), images disabled, javascript: links dropped by the default validateLink, and
  links forced to target=_blank rel=noopener noreferrer nofollow. No hand-rolled sanitizer
  anywhere, per owner directive. plainTextFromRichText/hasRichText replaced every ad-hoc
  tag-strip regex (person-popover, content-diff, embeds ICS/JSON, widgets ICS, submit review
  step, forms maxChars). rich-text-guard.test.ts pins dangerouslySetInnerHTML to 4 sanctioned
  files; 10 unit tests cover rendering, escaping, and projection. Seed rich-text values are now
  markdown; Biography participant field is fieldType richtext (seed + live DB). Mail
  confirmation() customBody renders through markdownToHtml (it previously escaped the
  organizer's formatting into visible tags). API docs note bio/description fields are
  CommonMark.
- Aug 12 — V2-009 (screenshot-verified): reviewer workspace and admin desk detail rendered
  stored rich text as literal markup. Both now render through RichText — blind reviewer detail
  (Sam, SESS-1/SESS-2) shows clean prose inside .rte-content with real <p> DOM, and the desk
  detail renders Description + Biography with formatting. displayAnswer routes richtext-type
  fields (including per-speaker array answers, which previously short-circuited to join) to
  RichText.
- Aug 12 — V2-014 (screenshot-verified): portal profile save state is now three-valued —
  pending review saves show "Saved — sent for organizer approval" (2.6s) instead of a bare
  "Saved" that looked like a silent success while the public profile stayed unchanged. Verified
  end-to-end: confirmed speaker's bio edit → banner + pending indicator → value survives hard
  reload; organizer comparison view → Approve applies the snapshot (V2-015 verified in the same
  pass: both diff columns render plain text via plainTextFromRichText, not raw markup).
- Aug 12 — V2-017 (screenshot-verified): "Add request" no longer creates orphan file requests.
  TaskTemplateMutationRequest.completion is a tagged union (manual | form:id | file:id |
  file:new) so a form link and file link can never both be set; saveTaskTemplate runs in one
  db.transaction and, for file:new, creates the fileRequests row (title/instructions/scope/due
  copied) and links it to the task atomically — a task edit no longer recomputes position
  (templates stayed put). Deliverables "Add request" (section header AND the previously
  requirement-only empty state) opens the Create task dialog preset to "File · New request";
  the raw request dialog remains for pencil-edit. Toast is honest: "Task and file request
  created — assigned to 2 speakers". Verified: DevFlow → Add request → task saved → request row
  shows its linked task (no "Not assigned to any task yet"), DB shows request + linked template
  + 2 todo assignments, and Priya's portal lists "Final slide deck" with Upload.
- Aug 12 — Deploy + prod verification (screenshot-verified): app.opensesh.io, opensesh.io, and
  docs.opensesh.io deployed; prod DB reseeded (seed verification passed). Re-verified against
  prod with screenshots: desk detail and blind reviewer workspace render rich text through
  .rte-content (V2-009), Deliverables "Add request" creates task + file request atomically with
  the honest toast and the linked row (V2-017), Priya's portal lists the file-request task with
  Upload, profile bio edit saves and survives reload (server response confirms auto-approve for
  the unconfirmed speaker), public event page and landing render cleanly. Prod DB reseeded
  again after verification so the eval starts from pristine fixtures (53300 too-many-
  connections is transient — retry loop succeeded on attempt 3). Standing issues: docs site
  SSRs full content but the vocs/waku client bundle crashes on hydration and blanks the page
  (paused per owner instruction; flagged as a spawn-task chip), and the prod ANTHROPIC_API_KEY
  must be set by the owner (`pnpm exec wrangler secret put ANTHROPIC_API_KEY` in apps/web).
- Aug 12 — Docs migrated from vocs to Cloudflare Nimbus (owner request, screenshot-verified
  local + prod): apps/docs is now a Nimbus (Astro 7 static) scaffold — all 26 pages carried
  over with title frontmatter, sidebar mirrors the old nav exactly (Overview / Guides / API
  reference with Overview first, via autogenerate + sidebar.order), tokens rebranded to
  opensesh green (#1d6b4c → oklch, light + dark), opensesh mark favicon, same opensesh-docs
  worker + docs.opensesh.io custom domain. Root docs page renders at "/" by mapping the
  "index" entry to the undefined rest segment in the catch-all — the same convention Nimbus's
  own .md/.mdx twin routes use. Two defects died with the migration: the vocs/waku hydration
  crash that blanked every page in prod (fresh-tab console now clean, spawn-task chip
  withdrawn), and literal \{eventId\} backslashes the vocs pipeline rendered in API paths
  (normalized to {eventId} during migration). Strict upgrades gained: working client-side
  search (pagefind), llms.txt + per-page markdown twins ("View as Markdown"), OG images,
  sitemap, dark/light toggle. astro check, nimbus-docs lint (26 clean), and build all green.
- Aug 12 — Nimbus theme FOUC fix (upstream cloudflare/nimbus#84): the theme bootstrap in
  BaseLayout.astro was a bare <script>, which Astro bundles into a deferred module — dark-mode
  readers got a light flash before it ran. Now `is:inline` so it blocks in <head>; verified the
  built HTML emits the raw script before NimbusHead. (Deploy pending — held for the running V3
  eval.)
- Aug 12 — Conditional CFP fields unmount (V3 finding, browser-verified): FormRenderer used to
  render every field and hide unmet-condition ones with an aria-hidden CSS wrapper, so hidden
  inputs stayed in the DOM and accessibility tree ("the Workshop field renders for Talk").
  Structural fix: fields failing isFormFieldVisible return null — never mounted; entrance
  animation preserved with @starting-style on .conditional-field-visible. Verified on the
  DevFlow public wizard with a temporary Notes-on-Workshop condition: Format=Talk → zero
  textareas, no label, absent from the a11y tree (read_page); Format=Workshop → field mounts.
  Local DB reseeded after (seed itself ships no conditional fields).
- Aug 12 — Portal submission edit footer (owner screenshot): the edit form rendered two
  stacked border-t rows — Save changes in FormRenderer's footer, Withdraw submission in its
  own row below. FormRenderer gained a footerStart slot (left side of the single footer row,
  used when no Back button); portal-submissions passes the Withdraw dialog there. The
  standalone row remains only for closed/no-fields submissions where the form footer doesn't
  render. Verified: one row, Withdraw left / Save right, same baseline.
- Aug 12 — Speaker portal library leak (found during verification): speakerBootstrap loaded
  the entire tracks/formats/tags/levels tables unscoped, so a speaker's edit dropdowns offered
  every event's options (duplicate "Talk (30 min)", other events' tracks) and could save a
  cross-event format id. All four library queries now join contacts and filter to the
  speaker's event — same shape adminBootstrap already used. Verified: DevFlow dropdowns show
  exactly 5 formats / 3 tracks / 3 levels after the fix.
- Aug 12 — Select trigger sizes made honest (owner screenshot: CSV import dialog): eleven
  SelectTriggers carried h-7/h-8/h-9 className overrides that silently LOSE to the stock
  shadcn `data-[size=default]:h-9` rule (class+attribute selector wins), so they all rendered
  36px. Converted them to the stock `size="sm"` variant (real h-8) and dropped the dead
  classes; the CSV import dialog's Create badge is wrapped to the same h-8 so mixed
  Update/Create rows keep uniform height (measured 47/47/46px after, trigger data-size="sm").
