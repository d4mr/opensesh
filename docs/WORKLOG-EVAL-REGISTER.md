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
| OS-038 | refuted | a11y follow-up | Reset-mechanism doesn't fire (`useEffect` deps on string `card.stageId`); Move button works. Salvageable finding: dnd has PointerSensor only — no KeyboardSensor; drag handle doubles as open-contact button. Rescoped to P3 a11y. |
| OS-039 | confirmed (worse than filed) | fix | Copy is ACCURATE — sendCrmCampaign hardcodes addToEvent(role speaker, status invited) per recipient (server-fns/crm.ts:315). Worse: upsert conflicts on contactId ALONE, so emailing about Event B RE-POINTS an existing Event A link. Fix: conflict on (contact,event) + explicit opt-in checkbox in CampaignDialog. |
| OS-040 | confirmed gap | deferred | No score column on crm_pipeline_cards. Register itself ranks this behind everything; skip for contest. |
| OS-049 | confirmed gap | accepted-gap | Custom CSS injection into embeds is a security-sensitive feature the register itself defers; theme+color tokens cover contest scope. |
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
