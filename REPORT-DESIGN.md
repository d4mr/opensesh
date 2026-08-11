# REPORT-DESIGN — Form editor Linear pass

Branch: `worktree-agent-a8a6029cfa55198a5` (merge of `main` included, conflicts resolved).

## What changed

### 1. Condition editor (`apps/web/src/components/forms/form-field-builder.tsx`)

The old editor crammed field-select + operator + value + remove into one third of a
3-column grid; value inputs rendered ~2ch wide. Now:

- **Full-width sentence row** at the bottom of each field card, in a tinted
  `bg-muted/40` panel: `Show when [field] [is] [value] … x`.
- Clause selects are **borderless h-7 triggers** (`border-0 bg-transparent`,
  `hover:bg-muted/60`) so the row reads as an editable sentence, org-settings
  role-select style. Operators read as words: "is" / "is any of".
- Value control adapts: library/custom-option sources get a select with
  placeholder "choose an option" (equals) or **toggle chips** (is any of,
  active = `bg-background ring-1 ring-border`); free-text sources get a real
  `h-7 w-44` input. Values still store option **ids**, and are cleared when the
  source field changes (both pre-existing correctness rules preserved).
- Remove is a quiet `icon-xs` ghost x pinned right.
- **No-condition state** is a ghost affordance: `Always shown — add condition`
  (hidden when the card has no candidate source fields). Clicking seeds a
  condition on the first candidate.

### 2. Live preview (`apps/web/src/components/forms/form-preview.tsx`, new)

There was no preview at all. Now the editor header's primary action is
**Preview**, opening a right-side Sheet:

- **Why a Sheet:** it overlays without losing editor context, and is sized
  `sm:max-w-xl` — the exact column width of the public wizard — so the preview
  is dimensionally honest. An inline toggle would have squeezed either surface;
  a new tab would show *saved* state, not the editor's local state.
- Renders the **actual `FormRenderer`** (not a lookalike) from the editor's
  current unsaved state: form values come through `form.Subscribe`, fields are
  the editor's `FormFieldReplacement[]` mapped to `FormFieldDefinition[]` with
  the same id fallback the builder uses, so unsaved conditions resolve.
- Three panes — Welcome / Questions / Speakers (Speakers only when
  `collectParticipants`) — switched by a **sliding-pill segmented control**
  (one persistent measured element, `useLayoutEffect` + ResizeObserver, no
  mount animation, 200ms `--ease-out`), or by walking the flow with the real
  Continue buttons. Validation, character counters, conditional reveal/hide
  (`.conditional-field`), and `.wizard-step` / `.wizard-fields` motion all run
  exactly as on the public page.
- Footer whisper: "Rendered from your unsaved changes — nothing you type here
  is submitted." Answers are local state, reset on each open.

### 3. Editor shell polish (`apps/web/src/routes/admin.forms_.$formId.tsx`)

- **Card and numbered dot-train removed** (both on the DESIGN.md do-not list).
  Step content is a plain column: `text-base font-semibold tracking-tight`
  heading + 13px subtitle, `wizard-step` entrance keyed on step, house footer
  rail (`border-t pt-4`, ghost Back left, outline Next right; the last step
  closes with "Preview the form").
- **Left rail** is now quiet icon nav rows: h-8, 13px, selected-row fill
  (`bg-muted`), per-step lucide icons, `aria-current="step"`.
- **Tinted `SettingPanel` / `SettingRow`** (ported from org-settings-dialog)
  replaced every bordered toggle box: collect-participants, show-welcome,
  speaker role + min–max, form open / multiple drafts / auto-redirect,
  confirmation email. Overline labels ("Page copy", "Speakers", "Questions")
  give each step internal hierarchy without boxes.
- Kind picker tiles use the circle family (CircleCheck selected / CircleDashed
  idle) with a soft `bg-muted/50` fill instead of a hard ring.
- Admin-alert recipients are a selected-row-fill pick list (row `bg-muted` when
  checked) instead of bordered checkbox chips; stale "delivery lands in WP7"
  codename copy replaced.
- Field cards use the grouped-repeatable pattern: `h-10 border-b bg-muted/40`
  header strip holding the grip, a **borderless inline title input**, lock
  glyph, and ghost move/delete actions; body holds a labeled compact property
  row (Type with human names — "Short text", "Rich text"… — Max chars and
  Options only when applicable, Required switch right-aligned). Add-another is
  a ghost muted "Add question" under the list; empty sections get a dashed
  empty state.
- Header: contextual h1 (the form's internal name, live via `form.Subscribe`),
  copy-link with a "Copied" check flash, quiet ghost Open, and **one primary
  action: Preview**.

## Merge with main's perf rewrite

`git merge main` conflicted only on the route file. Resolved by taking **main's
save/navigation logic verbatim** — `buildPayload`/`persist` serialized
background saves, instant `changeStep`, `markDirty` store subscription, 2s
trailing autosave, beforeunload guard, and its `SaveStatus` whisper component —
and keeping this branch's markup. Consequences embraced: the manual Save button
is gone (autosave + SaveStatus whisper + error-retry replace it), footer
navigation no longer disables while saving. `pnpm check --fix` clean after the
merge (191 files, 0 errors).

## Verification (real browser, vite dev on :3040, demo login)

All flows exercised on the seeded "Session Submission Form", pre- and
post-merge, dark and light schemes (screenshots in session transcript):

- All six steps rendered and navigated via the rail (post-merge: instant).
- Condition editor on the Level card: added via the ghost affordance, source
  switched Title -> Format (values correctly cleared), equals -> library select
  listing Keynote/Talk/Workshop… by **name** (ids never shown), "is any of" ->
  chip toggles (Talk + Workshop), saved to the server, survived reload.
- Preview: Welcome pane shows live title/welcome prose/close+limit line;
  Questions pane runs the real renderer — choosing Format = "Workshop (30 min)"
  **revealed the conditional Level field live**; pane pills slide; footer
  whisper present.
- Autosave whisper cycle observed after an edit: `Saved -> Unsaved -> Saving ->
  Saved`; edit persisted.
- `pnpm check --fix` clean; `packages/domain` untouched.

## Notes / unresolved

- The Browser-pane's synthetic pointer clicks did not register on this machine
  (tool-level issue, not app: real DOM/keyboard events worked everywhere), so
  interactions were driven via dispatched events; visual evidence via
  screenshots. Worth a quick human click-through.
- The pane also twice self-navigated to the production origin
  (app.opensesh.io) mid-session — unrelated to this change, but noting it.
- Preview panes label the sections "Welcome / Questions / Speakers" (fixed
  short labels) rather than the editable section headings, to keep the pill
  switcher stable while typing.
