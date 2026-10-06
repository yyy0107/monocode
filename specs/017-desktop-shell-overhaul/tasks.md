# Tasks

## Phase 0 — record
- [x] Spec, plan, contracts and tasks recorded; `.specify/feature.json` points here.

## Phase 1 — command registry and menu bar
- [x] 1a Save keybinding overrides under English ids in zh-CN; regression test.
- [x] 1b Registry and dispatcher; key handler and native listeners dispatch by id.
- [x] 1c Always-visible Windows/Linux menu bar with setting; Close Pane fixed.
- [x] 1d Title bar, session pane, terminal dock and footer hints follow
  effective shortcuts. Sidebar and activity-bar hints follow Phases 2 and 4.
- [x] 1e Match the requested top-row layout: navigation before menus and
  native window buttons at the far right; remove repeated lower chrome and
  preserve the hidden-menu/macOS fallback.

## Phase 2 — quick open
- [x] Prefix modes (files, `>`, `#`, `@`), search-everywhere row, shell icons.

## Phase 3 — app views as tabs
- [x] Model, snapshot and tab-group changes.
- [x] AppViewHost, renderer context, Settings/Notes/Automations as tabs.
- [x] Search and Inbox as tabs; remove the five view booleans.
- [x] Preserve view state while hidden; hide portal overlays and suspend their
  global handlers. Close existing/restored Notes tabs when Notes is disabled.

### App-view layout and loading follow-up
- [x] Restore a bounded-height flex chain from FilePane/AppViewHost to the view
  so long Settings pages and other app-view content scroll within the pane.
- [x] Confine first-use lazy loading to the app pane; keep the window shell and
  neighbouring panes visible throughout the switch.
- [x] Add regressions for the host layout and local loading fallback while
  preserving existing hidden-view state and portal behavior.
- [x] Verify affected tests, web checks, Host tests and production build; check
  browser geometry and scrolling for long Settings pages and a representative
  app-view layout, including short and split panes. Record actual outcomes.
- [ ] Manual Linux zh-CN Tauri QA: verify app-view scrolling and local loading
  in the native window, including panes resized by a visible terminal dock.

## Phase 4 — activity bar and single sidebar
- [x] Persist sidebar width.
- [x] Extract ProjectList/ProjectAvatar/useUpdateStatus.
- [x] ActivityBar, single Sidebar, ⌘B, keybinding migration, remove rail mode.
- [x] Animate sidebar expansion/collapse; preserve immediate resizing and
  saved width, handle rapid reversal and reduced motion, hide closing portals.

## Phase 5 — multi-project tree
- [x] 5a [P] Retain more than 20 projects; persist/rebase/remove expansion state.
- [x] 5b [P] Named ProjectList tree rows, children, status, new-chat/menu actions;
  remove project avatar rail while retaining window-wide navigation.
- [x] 5c [P] Remote cached summaries while collapsed, deduped one-shot search
  reads, scoped loading/error/offline state and polling cleanup.
- [x] 5d App project-keyed history loads and refreshes, per-project new chat,
  project-scoped remote identity and live history overlays.
- [x] 5e Single Sidebar shell and extracted per-project one-line session tree;
  preserve folders/reminders/pins/actions, scoped selection and drag boundaries.
- [x] 5f Global project/title search with four concurrent reads, transient
  ancestor expansion and incomplete/error handling.
- [x] 5g Initial active Explorer/Changes content bounded to 60%/420px while
  project names remain available; superseded by the project-switcher follow-up
  below. Preserve the historical implementation and validation record.
- [x] 5h Regression coverage and web/Host/build checks; record versions and
  browser/native verification separately without claiming unrun scenarios.
- [x] 5i Codex-style tree layout: child rows indented to the project name,
  avatar-as-disclosure with hover chevron, quieter headers highlighting only the
  active chat, five-chat project preview with Show more/Show less.
- [x] 5j Clicking an open project's name collapses it; project rows slide
  open/closed with the shared fold animation.
- [x] 5k Keep session row gaps at 4px across collapsed and expanded folders,
  pinned sessions and reminders; remove extra group margins/bottom padding.
- [x] 5l Record the standing disclosure motion rule in AGENTS.md and share
  AnimatedCollapse across project groups/children and session folders/pins/reminders;
  cover closing lifetime, reversal, reduced motion and hidden surfaces.
- [x] 5m Apply shared disclosure motion to terminal dock grid tracks; preserve
  running terminal views, immediate resizing, committed size and reduced motion.
- [ ] Manual Linux zh-CN Tauri QA: exercise the project tree in a native window,
  native shortcuts/animation, real Shared Host connectivity and application
  restart with more than 20 projects; mobile runtime smoke test remains unrun.

### Files/Changes project switcher follow-up (2026-10-05)

The below-tab picker/worktree placement in 5n was implemented and verified at
that revision. Its placement is superseded by the header-controls follow-up
below; the full-height working-copy behavior and historical results remain.

- [x] 5n Add the existing compact ghost SearchableProjectPicker below the tabs
  in multi-project Files/Changes with an optional visible current-project label;
  reuse selection/open handlers and keep the existing worktree toolbar directly
  below it. Preserve Sessions and the single-project ProjectList/bounded
  working-copy behavior without adding a picker when recents is undefined.
- [x] 5o Render one active working copy through shared local JSX with full
  remaining height in multi-project mode; remove its Files/Changes ProjectList
  branches, expansion gating and obsolete 60%/420px sizing while retaining the
  legacy single-project wrapper. Keep Files scrolling internally and Changes
  vertically scrollable; show the localized Choose project hint for empty/`~` cwd.
- [x] 5p Update affected sidebar/project regressions for one working copy,
  no project-tree rows, current-project picker/selection and current-only diff
  statistics; preserve Sessions rename/hover-summary behavior and cover the
  empty and single-project modes.
- [x] 5q Run affected shell/project tests, check:web, test:host and build.
  Verify in a manual or browser preview that selecting another project updates
  the file tree and Changes statistics and fills the remaining sidebar height;
  record actual outcomes separately from native/platform limits.

### Files/Changes header controls follow-up (2026-10-05)

- [x] 5r Replace the top Projects title in multi-project Files/Changes with the
  project picker and a compact branch/worktree selector for an available local
  Git project. Keep quick-open/search and add on the right and tabs immediately
  below the header; remove the standalone picker/worktree rows in these modes.
  Preserve selection/open handlers, full-height working-copy scrolling, the
  empty-project hint and Sessions/single-project header/worktree behavior.
- [x] 5s Update focused regressions for header placement, branch/worktree
  availability, absence of standalone rows, selection and current-only diff
  statistics; cover empty, Sessions and single-project modes.
- [x] 5t Run affected shell/project tests, check:web, test:host and build, then
  preview project/branch controls in Files and Changes, including narrow-sidebar
  layout and full-height content. Record actual results and tool versions;
  keep native/platform limits explicit.

## Hover summary follow-up
- [x] Shared immediate hover/focus interaction and 320px summary layout,
  safe dismissal/return focus and ancestor visibility.
- [x] Structured session title/status and optional metadata; preserve prefetch
  and subagent tooltip priority.
- [x] Project avatar/name/pin, full path/remote identity, Edit project and
  optional accurate counts with lazy loading/cached error states.
- [x] Regression tests, browser theme/language/narrow/edge QA, check:web and
  build; execute test:host and record its independent failure below.
- [ ] Native Linux Tauri visual QA and real remote connectivity for these
  summary cards remain unrun. This UI follow-up does not resolve the concurrent
  Host orchestration lifecycle failure recorded below.

## Validation evidence

- Baseline 2026-10-05 (Node v24, Vitest 3.2.7, TypeScript 5.8): with the
  system locale `zh_CN.UTF-8`, 16 existing tests in 7 files fail because they
  expect English text; with `LANG=en_US.UTF-8` all 453 files pass. All runs
  below use `LANG=en_US.UTF-8`.
- Phase 1: `npm run check:web` passed (455 files, 4735 tests; tsc clean).
  `npm run build` passed. The zh-CN keybinding regression test fails without
  the fix and passes with it.

- Phases 2–4 affected regressions passed, including real App composition with
  Inbox in PaneTree, retained sidebar/footer/terminal dock, Chinese live titles,
  unique view instances and hidden state, file and both diff modes returning to
  the project's recent content tab with its cwd, Escape retaining the app tab,
  Ctrl+W/Close All on the sole app tab retaining the project, Notes disabling,
  snapshot round-trip/duplicate rejection, activity pop-outs and sidebar width.
- Tool versions used: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
  TypeScript `5.8.3`, `tauri-cli 2.11.4`.
- `npm run test:host` passed: 28 files, 193 tests; 1 file and 5 tests skipped.
  The Host build/type check included in the script passed.
- Manual Linux zh-CN Tauri acceptance was not run. DOM integration tests cover
  UI composition and behavior; they do not verify native window layout or
  native accelerator delivery. macOS and Windows remain unverified. No Rust
  files changed, so `npm run check:rust` was not run.
- Existing architecture limitation: moving an app pane to another workspace
  tab remounts its view, as it changes React parents; ordinary tab switches
  preserve local view state. Snapshot restoration stores kind only, as specified.
- Final `npm run check:web` passed: 465 files, 4821 tests; 2 files and 13
  tests skipped; TypeScript clean. An earlier run overlapped a production build
  and timed out in the file editor lazy-import test; that file's 9 tests passed
  alone and the final full check passed without a concurrent build.
- Final `npm run build` passed. Vite reports the existing CSS `::highlight`
  optimizer warnings and the bundle-size advisory; no build errors.
- `git diff --check` passed. Verification used the local working tree.
- Top-row follow-up: `npm run check:web` passed with 465 files and 4830
  tests (2 files and 13 tests skipped), TypeScript clean. Regressions cover
  control order, disabled history arrows, dispatcher actions, sidebar state,
  native window actions/maximize-to-restore state, Chinese shortcut hints and
  menu-hidden layout restoration, and temporary Alt-row dismissal on Escape,
  outside click and blur. `npm run build` passed with the existing
  CSS optimizer and bundle-size advisories. Native visual checks remain unrun.
- Menu-row height increased from 28px to 36px; the Alt overlay remains centered
  within the 40px fallback title row. The 22 affected MenuBar/App integration
  tests and `npm run build` passed; `git diff --check` passed.
- Activity bar removes its 40px top spacer when the menu row is pinned;
  macOS and hidden-menu mode retain the title-row spacer. The 19 affected
  ActivityBar/App integration tests, `npm run build` and `git diff --check`
  passed.
- Sidebar motion: 75 affected tests passed, including close/reopen reversal,
  hidden portals, reduced motion and closing during a live resize without
  saving zero width or leaving pointer listeners. Final `npm run check:web`
  passed with 466 files and 4838 tests (2 files/13 tests skipped), TypeScript
  clean. One earlier full run failed the file editor's blur navigation test;
  its 9 tests passed alone and the final full check passed.
  `npm run build` and `git diff --check` passed. Native frame animation has
  not been visually verified.
- App-view layout/loading follow-up: `LANG=en_US.UTF-8 npm run check:web`
  passed with 466 files and 4844 tests (2 files/13 tests skipped); its TypeScript
  check passed. The 4 `AppViewHost` regressions also passed on their own.
  `npm run build` passed with the existing CSS `::highlight` optimizer,
  bundle-size and mixed static/dynamic import advisories. `npm run test:host`
  passed with 28 files and 193 tests (1 file/5 tests skipped), including the
  script's Host build/type check.
  Versions rechecked for this follow-up: Node `v24.16.0`, npm `12.0.1`,
  Vitest `3.2.7` and TypeScript `5.8.3`. The focused final
  `git diff --check` passed; the temporary preview was cleaned up and its
  server stopped.
- A real in-app browser fixture used the actual `FilePane` and `SettingsView`
  components. Appearance content measured 600px client height / 1578px scroll
  height; wheel input moved `scrollTop` to 977.6px. Switching to another tab
  and back retained 977.6px and did not show a loading fallback.
  In a short, split pane, content measured 260px / 2191px and navigation
  measured 260px / 459px; wheel input independently reached 1697.6px and
  199.2px. The Settings header stayed fixed at viewport top 48px.
- In the same browser fixture, light-theme Keybindings measured 600px / 2188px
  and wheel input reached 1588px. A representative second app-view layout
  measured 600px / 3840px and scrolled to 720px. With lazy content deliberately
  delayed, the shell retained its 48px height, `globalBlank` remained false,
  and the Loading fallback appeared only inside the pane.
- These browser checks establish actual overflow, wheel scrolling, retained
  scroll position and pane-local loading in the fixture. A real terminal dock
  and the native Tauri window were not exercised; reduced fixture height only
  verifies a smaller pane. Native Linux zh-CN QA remains pending, and macOS
  and Windows remain unverified.
- Multi-project tree follow-up (2026-10-05): final
  `LANG=en_US.UTF-8 npm run check:web` passed with 470 files and 4899 tests
  (2 files/13 tests skipped); TypeScript passed. Focused integration tests
  cover independent project loads, deduplication/out-of-order responses,
  removed-project invalidation, inactive rename refresh, remembered-worktree
  creation, project-scoped remote IDs/deletion and stale navigation order.
  Tree/cache tests cover temporary search expansion, four-read concurrency,
  failed retries, offline/unregistered remote cache, Shared Host routing,
  same-ID reminder/update isolation, complete-list folder pruning, blank remote
  folder members, scoped selection/drop and working-copy bounds. Existing
  sidebar resize/animation/menu/folder and project group/pin/order tests passed
  in the full check. Some React act warnings remain in UI test output; no
  assertion or TypeScript failures occurred.
- `LANG=en_US.UTF-8 npm run test:host` passed with 28 files and 193 tests
  (1 file/5 tests skipped), including Host build/type checking. Final
  `npm run build` passed with the existing CSS `::highlight` optimizer and
  bundle-size advisories. Versions rechecked: Node `v24.16.0`, npm `12.0.1`,
  Vitest `3.2.7`, TypeScript `5.8.3`, `tauri-cli 2.11.4`. No Rust or Host
  protocol changes were made; `check:rust` was not run.
- Retention regression adds 25 projects and re-reads localStorage, keeping
  project-0 and the original `{path, openedAt}` format. Reopen deduplicates;
  rename/archive/delete maintain order, pins and normalized expansion keys.
  This simulates storage reload; it is not a native application restart test.
  Source inspection confirms MobileDrawer/Picker use `HostProject[]` from Host
  `projects.list`, rather than desktop recents. Shared desktop project pickers
  retain their existing schema; mobile runtime QA was not run.
- A Linux zh-CN browser fixture rendered actual Sidebar, ProjectList,
  ActivityBar, FileTree and SourceControl with production CSS and stubbed IPC.
  ActivityBar measured 48px, project headers 32px, session rows 28px and saved
  sidebar width 310px. Long titles stayed on one line. Searching a collapsed
  mobile project revealed its six matching chats without activating it;
  clearing restored two expanded projects and the mobile project's collapsed
  state. Collapsing a project by disclosure retained the active project.
- In that fixture, a 620px shell gave Files a 325.2px bounded region. At a
  300px shell height, Files/Changes stayed at 133.2px (60% of the tree viewport),
  with other project names retained. Files had a 65px/720px inner scroller;
  wheel input reached 654.4px while the project-tree scroll position stayed 0.
  Changes kept a 480px inner surface, a usable 113px/736px file scroller and
  an independently scrolling 133px/480px outer region; wheel input reached
  346.4px. The Chinese component screenshot was saved at
  `/tmp/monocode-project-tree-qa/sidebar-tree-zh-CN.jpg`.
- Browser IPC was stubbed; no real offline machine, native Tauri window,
  native accelerator/animation or mobile runtime was exercised. Native
  acceptance remains explicitly pending above. Final `git diff --check`
  passed; implementation and validation records stay in the local working tree.
- Row alignment/spacing follow-up: project headers and all session cards now
  share 32px height and exact horizontal bounds, including folder/pinned/reminder
  members and inline rename. Browser measurements matched 287.6px widths in
  ordinary projects and 279.6px inside a project group. Actual adjacent session
  gaps measured 4px, project-header-to-first-item gap 4px and folder/pinned group
  separation 8px; nested lists have zero horizontal padding. Group boundaries
  avoid accumulating trailing margins. The preview screenshot above was
  refreshed to this final layout.
  The 64 affected sidebar tests and 12 project/group tests passed. Final
  `LANG=en_US.UTF-8 npm run check:web` passed: 470 files, 4900 tests,
  2 files/13 tests skipped, TypeScript clean. Final `npm run build` and
  `git diff --check` passed, with the same existing build advisories.
- 5i Codex-style tree layout: ProjectSessionSection/ProjectList tests cover the
  five-chat preview, Show more/Show less, the active chat beyond the preview,
  folder members not counted and untruncated search. Browser QA used a
  temporary Vite fixture rendering the real zh-CN Sidebar at 310px width:
  project names and chat titles start at the same x (40/41px), rows are 32px
  with 4px row and 8px group gaps, only the active chat is highlighted,
  展开更多/收起 toggles 5↔8 chats and search finds the 7th chat. Hover was
  verified by class/computed style only (avatar shown, chevron hidden until
  group hover); a real pointer hover and native Tauri QA were not run.
  `npm run check:web` passed (470 files, 4903 tests; 2 files/13 tests skipped),
  `npm run test:host` passed (28 files, 193 tests; 1 file/5 tests skipped),
  `npm run build` passed with the existing CSS optimizer and bundle-size
  advisories, and `git diff --check` passed. No Rust changes.
- 5j Name-click collapse and fold animation: a new Sidebar test covers
  collapsing an open project from its name without activation, the closing
  state being inert, unmounting after the fold and opening a collapsed project.
  In the temporary browser fixture the rows eased 220px→0 (opacity 1→0) in
  about 300ms and back again, then unmounted/settled; collapsed headers kept
  their 36px pitch. One full `npm run check:web` run failed the 8
  FilePaneNavigation tests (they passed alone, 9/9); the rerun passed with
  470 files and 4904 tests (2 files/13 tests skipped). `npm run test:host`
  (28 files, 193 tests), `npm run build` and `git diff --check` passed.
  Native Tauri animation was not checked.

- Consistent session spacing follow-up (2026-10-05): the requested uniform
  4px spacing replaces the earlier 8px session-group separation. Dense folder,
  pin and reminder groups no longer add bottom margins; expanded member lists
  retain 4px top/row spacing without trailing padding. Project-group separation
  remains 8px. Updated the existing layout assertions; 81 affected tests passed.
  `LANG=en_US.UTF-8 npm run check:web` passed with 470 files/4904 tests
  (2 files/13 tests skipped), TypeScript clean. `npm run build` passed with
  existing CSS optimizer and bundle-size advisories. `LANG=en_US.UTF-8 npm run
  test:host` passed with 28 files/193 tests (1 file/5 tests skipped), including
  Host build/type checking. Versions: Node `v24.16.0`, npm `12.0.1`, Vitest
  `3.2.7`, TypeScript `5.8.3`. Native/browser visual QA was not rerun for this
  spacing change; no Rust changes or Rust checks.

- Shared disclosure motion follow-up (2026-10-05): AGENTS.md now makes
  two-way expand/collapse motion a standing rule for new/modified disclosure UI.
  Extracted the existing project fold into `shared/ui/AnimatedCollapse`; project
  groups/children and session folders/pins/reminders reuse it and existing CSS.
  The component retains closing content until animationend (350ms fallback),
  makes it inert, hides nested surfaces, cancels stale timers on reversal and
  skips motion immediately under prefers-reduced-motion. Updated earlier
  integration assertions that assumed immediate unmounting.
  85 focused disclosure/sidebar tests plus 3 project-group tests passed.
  Final `LANG=en_US.UTF-8 npm run check:web` passed with 471 files/4912 tests
  (2 files/13 tests skipped), TypeScript clean. `npm run build` passed with
  existing CSS optimizer and bundle-size advisories. `LANG=en_US.UTF-8 npm run
  test:host` passed with 28 files/193 tests (1 file/5 tests skipped), including
  Host build/type checking. Versions rechecked: Node `v24.16.0`, npm `12.0.1`,
  Vitest `3.2.7`, TypeScript `5.8.3`. Native/browser animation visual QA remains
  unrun for this follow-up; no Rust changes or Rust checks.

- Terminal dock motion follow-up (2026-10-05): extracted `useCollapseMotion`
  from AnimatedCollapse and shared its 340ms duration/easing with grid-size
  transitions. Dock areas keep zero-sized tracks while closed, retaining the
  same mounted terminal views. Closing content is inert and its menus/focus are
  suppressed; direct resizing disables transitions, commits before hiding and
  releases pointer capture/cancels queued paint. All four dock sides follow the
  same rule, with saved-size restoration and immediate reduced-motion behavior.
  Final 48 affected tests in 5 files passed, including App composition,
  terminal-view lifetime, closing during resize and shared fold behavior.
  `LANG=en_US.UTF-8 npm run test:host` passed: 28 files/193 tests
  (1 file/5 tests skipped), including Host build/type checking.
  Full `LANG=en_US.UTF-8 npm run check:web` did not pass: 4926 tests passed,
  10 failed in ActivityBar/ProjectList/ProjectGroups amid concurrent project
  hover-summary changes; 13 tests skipped. `npm run build` stopped at TypeScript
  TS6133 errors in ProjectList for unused FolderOpen, MessageSquare, Settings
  and summary. These unrelated in-progress changes were preserved; the complete
  web check and production build remain unverified for the current tree.
  Versions rechecked: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`, TypeScript
  `5.8.3`. `git diff --check` passed. Browser/native terminal animation visual
  QA was not run; no Rust changes or Rust checks.

## Terminal dock disclosure motion — scoped commit

- [x] Share disclosure lifetime and grid-size motion; retain terminal instances
  while hidden, support both directions and rapid reversal, suppress hidden
  focus/menus, and respect reduced motion.
- [x] Keep direct resizing immediate; commit pending size, cancel queued paint
  and release pointer capture before hiding; restore the committed dimension.
- [x] Verify the isolated staged implementation against HEAD, excluding other
  unfinished project-tree, hover-summary and Host orchestration changes.

Validation on 2026-10-05: the staged implementation was exported with git archive
into an isolated temporary directory, using the repository's existing dependency
installation. `LANG=en_US.UTF-8 npm run check:web` passed: 468 files/4858 tests
(2 files/13 tests skipped), TypeScript clean. `npm run build` passed with existing
CSS optimizer and bundle-size advisories. `LANG=en_US.UTF-8 npm run test:host`
passed: 28 files/193 tests (1 file/5 tests skipped), including Host build/type
checking. Versions: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`, TypeScript
`5.8.3`. No Rust changes in this commit; Rust checks and browser/native animation
visual QA were not run. The complete working tree still contains unrelated
in-progress changes; these results apply to the staged implementation only.

- Hover summaries follow-up (2026-10-05): 139 affected tests in 9 files passed,
  covering shared intent timers/focus restoration, structured session values
  and status priority, hidden parent surfaces, project pin/edit without row
  activation, cached/error/no-loader states, unfiltered counts, genuine open
  blank chats, retained closed chats and equal remote IDs. The existing project
  notification menu's 6 tests also passed during focused project verification.
- `LANG=en_US.UTF-8 npm run check:web` passed: 477 files / 4959 tests;
  2 files / 13 tests skipped. The included TypeScript check passed. React act
  warnings remain in test output. `npm run build` passed with the existing
  CSS `::highlight` optimizer and bundle-size advisories. Final focused
  `git diff --check` passed. Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
  TypeScript `5.8.3`, tauri-cli `2.11.4` were read from the actual tools.
- `LANG=en_US.UTF-8 npm run test:host` ran its Host build/type check successfully,
  then exited 1: 33 files / 225 tests passed, 1 file / 5 tests skipped, plus
  one unhandled `ERR_INVALID_STATE: database is not open`. The concurrent Host
  orchestration work starts asynchronous recovery after engine construction;
  `host/desktop-import.test.ts` closes its store before awaiting engine recovery
  or engine.close. The single “refreshes imported native history” test reproduced
  the rejection independently; the other three desktop-import tests passed
  separately. No Host implementation or Rust changes belong to this UI
  follow-up, and its checks do not establish compatibility for that concurrent
  work. Host validation remains failed; no Rust check was run for this UI scope.
- A real browser fixture rendered Sidebar/ProjectList/ProjectSessionSection
  with production CSS and stubbed IPC. Both cards measured exactly 320px outer
  width, with 318px content client/scroll widths and zero horizontal overflow
  in long branch/path rows. Checks exercised both themes, en/zh-CN, the normal
  310px sidebar and its clamped 260px narrow width. At the viewport's right
  edge the card flipped left and stayed inside it. Pointer entry and transfer
  into the project card worked; Tab reached pin, Edit opened the existing
  project configuration menu, Escape returned focus to the original row without
  reopening, and sidebar closure made the surface inert with zero summaries.
  Screenshots: `/tmp/monocode-hover-summary-qa/project-light-zh-CN.jpg` and
  `/tmp/monocode-hover-summary-qa/session-light-zh-CN.jpg`. The temporary fixture
  and browser tab were removed; the user's existing dev server was retained.
  Native Tauri, real remote connectivity, macOS and Windows were not exercised.


## Files/Changes project switcher — historical below-tab validation (2026-10-05)

These results describe the earlier below-tab picker and worktree-toolbar layout.
The header-controls follow-up above supersedes that placement; these results do
not verify the new header layout.

- At that revision, multi-project Files/Changes used a 36px below-tab project
  picker and one working copy filling the remaining height. The shared picker
  accepts an optional
  visible label with compact avatar sizing; existing compact callers retain
  their default presentation. Empty cwd/`~` uses the existing localized Choose
  project key for the visible hint and switch-mode accessible label. No new
  translation keys were required. Sessions and the legacy single-project
  ProjectList/bounded working-copy path remain unchanged.
- `LANG=en_US.UTF-8 npx vitest run src/app/shell src/features/projects` passed:
  34 files, 306 tests. Regressions cover both tabs, no multi-project tree rows,
  visible custom labels, selection callbacks and controlled cwd changes,
  current-only diff stats, worktree-toolbar order, searchable keyboard selection,
  project opening, empty state, zh-CN labels and the single-project fallback.
- Final `LANG=en_US.UTF-8 npm run check:web` passed: 480 files, 5046 tests
  (2 files/13 tests skipped), including TypeScript checking. Existing React act
  warnings appeared in UI tests without assertion failures.
- `LANG=en_US.UTF-8 npm run test:host` passed: 34 files, 245 tests
  (1 file/5 tests skipped), including the script's Host build/type check.
  `npm run build` passed with existing CSS `::highlight` optimizer warnings,
  mixed static/dynamic import and bundle-size advisories. These results apply
  to the working tree at that revision, including unrelated pre-existing changes.
- Versions checked: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`, TypeScript
  `5.8.3`, Vite `7.3.6`, `tauri-cli 2.11.4`. This request changed no Rust code;
  `npm run check:rust` was not run.
- Browser preview used the real Sidebar, SearchableProjectPicker, FileTree and
  SourceControl with production CSS and stubbed IPC in zh-CN at 310px width.
  In a 760px shell, both working-copy surfaces filled the remaining 648px,
  exceeding the old 420px cap. Files kept a 580px/1500px internal scroller;
  wheel input reached scrollTop 900px while the working-copy outer scroll stayed
  zero. Picking beta from alpha changed the file root and header stat from
  +12/-3 to +37/-9. Searching beta and pressing Enter also selected it.
- In a 300px shell, Changes used the remaining 188px viewport with a 480px inner
  minimum; wheel input scrolled the outer region to 292px. Empty project state
  showed the picker and 选择项目 hint, with a matching accessible label. The
  screenshot is `/tmp/monocode-project-switcher-qa/sidebar-switcher-zh-CN.jpg`.
  The temporary fixture, tab and preview server were cleaned up.
- Native Tauri layout, actual filesystem/Git IPC, remote connectivity and
  macOS/Windows were not exercised by this preview. Native acceptance remains
  pending in the separate task above. `git diff --check` passed.

## Native window resize edges — validation (2026-10-05)

- [x] Add transparent Linux/Windows outer-window targets: 10 CSS px edge strips,
  16px corner squares and eight native resize directions. Mount through the
  workspace bootstrap, including the boot failure surface, and grant the
  existing Tauri start-resize-dragging command permission.
- [x] Disable targets for maximized/fullscreen/fixed-size windows and macOS or
  browser environments; handle stale state reads and late listener cleanup.
- [x] Run focused behavioral regressions, browser geometry/dispatch checks and
  the required web/Host/build checks.
- [ ] Real native desktop QA: Linux/Windows edge and corner drags, minimum-size
  constraints, maximize/restore, fullscreen, snapping and additional windows.

Evidence: the 15 focused WindowResizeHandles tests passed. Final
`LANG=en_US.UTF-8 npm run check:web` passed: 481 files / 5061 tests,
2 files / 13 tests skipped, including TypeScript checking.
`LANG=en_US.UTF-8 npm run test:host` passed: 34 files / 249 tests,
1 file / 5 tests skipped, including Host build/type checking. `npm run build`
passed with the existing CSS ::highlight optimizer, mixed static/dynamic import
and bundle-size advisories. These results cover the current working tree with
its unrelated pre-existing work; they do not establish native compatibility.

A temporary real-component browser fixture with stubbed native IPC measured
10px edges and 16x16px corners. All eight targets were hit at their centers and
inner points, displayed the appropriate cursor and dispatched the corresponding
native direction. Menu and all three window-button centers remained clickable.
Maximized/fullscreen/fixed-size states removed all targets; restore brought back
eight. The fixture and browser tab were removed; the existing dev server was
retained. No actual native window drag, OS snapping or platform QA was performed.
Internal sidebar/dock changes from the initial interpretation were fully reverted.

Versions read from the installed tools: Node v24.16.0, npm 12.0.1,
Vitest 3.2.7, TypeScript 5.8.3, Vite 7.3.6 and tauri-cli 2.11.4.
No Rust source changes belong to this request; check:rust was not run.
The added native capability requires restarting the desktop development process
or rebuilding the desktop binary before it can be exercised. `git diff --check`
passed.


## Files/Changes header controls — validation (2026-10-05)

- The user confirmed the top Projects title row as the destination. Multi-project
  Files/Changes now replaces that title with the project picker and compact
  branch/worktree selector, keeping quick-open and add on the right. Tabs follow
  immediately; the old separate project/worktree rows are removed in these modes.
  Sessions and the single-project header/worktree path retain their behavior.
- SidebarWorktreeSwitcher has an optional compact mode showing the current or
  focused worktree branch, a Git icon and chevron. Main-only Git repositories
  retain the menu; ordinary folders hide the compact control. Pending/error and
  deleted-worktree behavior remains shared with the original selector. The
  header keys the selector by cwd so old popup state cannot carry across projects.
  Detached labels reuse existing translations; no new i18n keys were added.
- `LANG=en_US.UTF-8 npx vitest run src/app/shell src/features/projects` passed:
  35 files, 324 tests. Header regressions cover the inline controls, no rows below
  tabs, retained search/add flows, and Sessions/single-project compatibility.
  SidebarWorktreeSwitcher and BranchPicker focused tests passed: 2 files,
  17 tests, including main-only/focused/detached branches, pending/error handling,
  ordinary-folder discovery and metadata failure.
- `LANG=en_US.UTF-8 npm run check:web` passed: 481 files, 5069 tests
  (2 files/13 tests skipped), including TypeScript checking. Existing React act
  warnings were emitted without assertion failures. `LANG=en_US.UTF-8 npm run
  test:host` passed: 34 files, 249 tests (1 file/5 tests skipped), including its
  Host build/type check. `npm run build` passed with existing CSS `::highlight`,
  mixed static/dynamic import and bundle-size advisories. These results apply to
  the working tree including pre-existing unrelated changes.
- Tool versions rechecked: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
  TypeScript `5.8.3`, Vite `7.3.6`, `tauri-cli 2.11.4`. No Rust code was changed
  by this header follow-up; `npm run check:rust` was not run.
- A real browser preview rendered production Sidebar/FileTree/SourceControl
  and both selectors with stubbed IPC in zh-CN, light and dark themes. At 310px
  width, the project, branch, quick-open and add controls fit on the same header
  row, with the tabs directly at the header's lower edge. A 700px shell gave
  both Files and Changes the remaining 624px working-copy height. There were
  zero standalone worktree rows below the header in these modes.
- The compact selector opened the existing working-copy menu and choosing the
  feature worktree changed its visible branch. Choosing pi-work from monocode
  changed the project name, branch main→master and diff stat +12/-3→+37/-9.
  At the minimum 260px sidebar width, all four header controls remained within
  bounds (clientWidth/scrollWidth both 259px); master fitted without truncation.
  A plain folder hid the branch control, and Sessions restored its original
  Projects title/search/worktree/tree layout.
- Preview screenshot: `/tmp/monocode-project-header-qa/header-switchers-zh-CN.jpg`.
  The temporary fixture, browser tab and preview server were removed. Browser
  IPC was simulated; native Tauri layout, real filesystem/Git/worktree switching,
  remote connectivity and macOS/Windows remain unverified. `git diff --check`
  passed.


## Other draggable regions — follow-up validation (2026-10-05)

- [x] Share 16px transparent panel resize targets and thin 2px hover/drag feedback
  across sidebar, workspace splits, graph panel, terminal docks and Inbox/Notes
  panel dividers, retaining their existing controllers.
- [x] Keep full one-sided targets outside content clipping; protect controls on
  the target's side and preserve responsive discussion-panel behavior. Keep
  scrollbars at their original edges.
- [x] Enlarge the Quick Composer drag strip to 20px and hue slider to 16px.
- [x] Preserve capture, reset and saved dimensions; keep hidden/closing targets
  inactive and retain shared sidebar/terminal two-way collapse motion and PTYs.
- [x] Run focused affected regressions and record their actual results below.
- [x] Run final `npm run check:web`, `npm run test:host` and `npm run build` for
  this follow-up and record results plus installed CLI versions.
- [ ] Browser geometry/interaction QA: verify full 16px targets on their assigned
  side, scrollbars 1px from the edge and neighboring button centers, drag/reset, closing
  and hidden state, both themes, narrow layouts and reduced motion.
- [ ] Real native desktop QA: internal panel and Quick Composer dragging,
  terminal lifetime while folding, and applicable Linux/Windows/macOS scenarios.

Focused results for this follow-up (not final full-suite validation):

- Sidebar, terminal docks, shared fold motion, App composition and useDragResize:
  5 files / 79 tests passed.
- Workspace split/graph regressions and existing pane drag/layout behavior:
  6 files / 82 tests passed, including PaneTree, TitleBarPaneDrop,
  PaneTreeTitleDrop, SurfaceTabsPaneDrag and layout coverage.
- Quick Composer, controls and color picker: 4 files / 20 tests passed.
- `LANG=en_US.UTF-8 npx vitest run src/features/inbox/ui/InboxView.test.ts
  src/features/inbox/ui/InboxViewWorkspace.test.ts
  src/features/inbox/ui/LinkedWorkItemPanel.test.ts
  src/features/notes/ui/NotesView.test.ts src/shared/hooks/useDragResize.test.ts`
  passed: 5 files / 39 tests. Vitest reported `3.2.7`. Scoped `git diff --check`
  passed for the Inbox/Notes implementation.

These groups were run independently and their totals can overlap. The browser
checks recorded below cover only their stated scenarios; real native dragging
remains unverified. Final full-suite results are recorded below. This scope changes no Rust source;
`check:rust` was not run. The existing dirty content and active-feature pointer
were retained.


Final user adjustment: the visible scrollbar remains thin and 1px from its edge.
Non-macOS scrollbar tracks are transparent and 12px on both axes, with a 6px
visible thumb: default transparent border 1px, vertical left border 5px and
horizontal top border 5px, using content-box background clipping. Panel targets
remain 16px on one side: right of vertical dividers and below horizontal ones;
Graph uses a real 16px track. The earlier proposed 8px two-sided clearances and
10px native root inset are removed. Inbox/Notes list right margins and preceding
discussion/linked-panel right padding are removed. Controls in the target's side
receive 16px content clearance, including detail/discussion/linked-panel left
padding; root/main reserves only left/top padding for following panels and no
additional right/bottom spacing.

Native resizing moves to window capture-phase `mousedown`, inspecting the real
target and passing through buttons, inputs, links, custom drag rails and actual
scrollbar tracks. Ordinary edges keep 10px bands and 16px corners. The eight
transparent direction nodes do not participate in pointer hit testing; pointer
movement only sets the resize cursor. This behavior still requires separate native
verification; no earlier mocked result establishes real desktop dragging.

No earlier focused result above is extended to this final geometry/native-event
adjustment. Final full-suite validation and remaining browser/native acceptance
stay open, including native target pass-through and applicable platform scenarios.

Inbox/Notes focused regressions were rerun after removing list right margins and
preceding discussion padding and adding one-sided left content clearance: the
same 5-file command above passed all 39 tests (Vitest `3.2.7`). Scoped
`git diff --check` passed for these products and the five updated design records.
This rerun does not establish final browser geometry or native interactions.

Browser checks for the final one-sided geometry (native IPC simulated):

- A 16px strip was hit 15px past the divider and was not hit 17px past it.
- Sidebar dragging, folding, saved-width restoration and double-click reset
  worked in the browser fixture.
- Project terminal dock resizing changed 150px to 190px on all four sides.
- Scrollbar tracks sat directly at the view boundary (0px track gap), with the
  visible thumb 1px from the right/bottom edge.

These exercises do not verify native window dragging, OS constraints/snapping or
platform behavior, and do not complete every theme/responsive/reduced-motion item
in the broader browser acceptance task.

Final verification (2026-10-05):

- `npm run check:web` passed: 483 files / 5085 tests, with 2 files / 13 tests
  skipped; TypeScript passed. This includes the native-target pass-through and
  initial split-drag displacement regressions.
- `npm run test:host` passed, including the Host build: 34 files / 249 tests,
  with 1 file / 5 tests skipped.
- `npm run build` passed. Vite reported its existing large-chunk warning.
- Actual CLI versions: Node `24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
  TypeScript `5.8.3`, Vite `7.3.6`, Tauri CLI `2.11.4`.
- The native edge capture focused suite passed 24 tests. Split/graph focused
  suites passed 84 tests after adding horizontal/vertical 15px-offset initial
  drag regressions. Editor/terminal focused suites passed 11 tests.
- Additional browser checks used actual CodeMirror and xterm components,
  without a PTY: editor rail 18px, terminal rail 14px, both visible thumbs 6px
  and exactly 1px from the right boundary. Both rails ended at the view boundary.
  Dragging their transparent target area scrolled the editor and terminal.
- With simulated native IPC active, dragging the native scrollbar at the
  window's right edge changed its scroll position to 476.8px and made no native
  resize call; a separate ordinary left-edge click dispatched `West`.
  Split drags starting 15px beyond the divider and moving 1px changed only the
  corresponding 1px ratio; the graph drag changed 140px to 180px.
- Browser proof: `/tmp/monocode-scrollbar-qa.png`. Temporary fixtures and browser
  tabs were removed; existing development servers and unrelated work retained.
- `git diff --check` passed. Real OS window resizing, constraints/snapping,
  cross-platform QA and native Quick Composer/PTY lifecycle remain unverified.


## Menu/title-bar drag initiation — follow-up validation (2026-10-05)

- [x] Inspect the existing path: the local Tauri 2.11.5 script immediately invokes
  native dragging from document-bubble `mousedown` on a first press; no application
  drag-delay timer was found. This script version is separate from the earlier
  recorded Tauri CLI version.
- [x] Add shared `startWindowDrag` and capture handlers for eligible Linux/Windows
  native first primary presses, dispatching before menu cleanup and without state
  awaits, frames or timers.
- [x] Preserve interactive/non-drag/portal exclusions, second-click maximize and
  window-edge resize precedence; close MenuBar's menu/Alt-reveal after acceptance.
- [x] Run focused capture-dispatch/order, control/portal/platform exclusion,
  menu-cleanup, double-click and edge-precedence regressions and record results.
- [x] Run final `npm run check:web`, `npm run test:host` and `npm run build` for
  this follow-up and record actual results and installed CLI versions.
- [ ] Real native Linux/Windows QA: record press-to-move observations/timing,
  ordinary menu/title dragging, control actions, double-click maximize and
  edge/corner resize precedence.

Focused validation (2026-10-05):

- `npx vitest run src/features/quick-composer/ui/useQuickAttachments.test.ts
  src/app/shell/startWindowDrag.test.ts src/app/shell/MenuBar.test.ts
  src/app/shell/TitleBar.test.ts src/app/shell/TitleBarMenu.test.ts
  src/app/shell/TitleBarPaneDrop.test.ts src/app/shell/WindowResizeHandles.test.ts`
  passed 7 files / 84 tests, including all 71 shell regressions and 13 attachment
  tests. Immediate invocation while the promise is pending, duplicate prevention,
  controls/SVG/portal exclusions, platform gating and menu cleanup passed.
- Browser checks mounted the actual MenuBar and WindowResizeHandles with simulated
  native IPC and the local Tauri 2.11.5 drag script. Opening File made no move
  request; dragging blank menu-bar space issued exactly one component API request
  during capture and closed the menu. Double-clicking blank space issued one
  capture move and one original document-fallback maximize; the Maximize button
  issued its own command without a move. A top-edge press dispatched `North`
  resize without adding a move request. Proof: `/tmp/monocode-menu-drag-qa.png`.
- Temporary browser fixtures and the created tab were removed. Existing servers,
  dirty work and the active-feature pointer were retained.

Final full verification (2026-10-05):

- `npm run check:web` passed on the standalone rerun: 484 files / 5100 tests,
  with 2 files / 13 tests skipped; TypeScript passed. The first concurrent full
  check had one failure in the unrelated pasted-image disk-error test (a fixed
  30ms wait), with 5099 other tests passing. Its 13-test file and the full suite
  passed on rerun without source changes.
- `npm run test:host` passed, including the Host build: 34 files / 249 tests,
  with 1 file / 5 tests skipped.
- `npm run build` passed; Vite reported the existing large-chunk warning.
- Actual CLI versions: Node `24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
  TypeScript `5.8.3`, Vite `7.3.6`, Tauri CLI `2.11.4`.
- Scoped `git diff --check` passed.

Actual native timing remains unverified. Earlier resize-target/scrollbar results
do not establish this handler's native behavior. No OS-delay resolution, measured
speedup or latency number is claimed. No Rust source changes belong to this scope;
Rust checks are not required for this implementation. The user has now authorized
a focused local commit for this follow-up.


## Focused local commit verification (2026-10-05)

The requested local commit contains only the drag-target, scrollbar placement and
menu/title-bar initiation changes. Mixed App, Sidebar and design records were
staged from HEAD with focused patches; unrelated Host/project-tree changes and
the active-feature pointer remain outside this commit.

An isolated checkout of the index, without the other dirty work, passed 20 affected
test files / 201 tests and `npm run build` (including TypeScript). The application
build retained existing CSS, mixed-import and large-chunk advisories. The earlier
5100-test web and 249-test Host results were from the full working tree; these
separate results establish that the focused staged source also builds and passes
its affected regressions independently. Real native drag latency remains untested.

## Immediate hover summaries — follow-up validation (2026-10-05)

- [x] Remove the shared 300ms opening and 180ms closing timers; disable
  entrance animation only on session/project summary cards.
- [x] Retain direct pointer transfers using the full trigger/frame boundaries,
  a 1px placement overlap and relatedTarget; retain keyboard focus transfers,
  Escape suppression, touch ignoring and hidden-surface dismissal.
- [x] Run focused summary/consumer/placement regressions and browser pointer QA.
- [x] Complete final web/Host/build checks and record their results below.

Focused verification passed: `LANG=en_US.UTF-8 npx vitest run
src/shared/ui/HoverSummary.test.ts src/shared/lib/popover.test.ts
src/app/shell/ProjectList.test.ts src/app/shell/ProjectSessionSection.test.ts
src/app/shell/SidebarProjectHoverSummary.test.ts` — 5 files / 88 tests.
`npx tsc --noEmit` passed. Existing React act warnings occurred in consumer tests.

A temporary browser fixture mounted the real HoverSummary/Popover with production
CSS. Slow pointer movement crossed the frame in both right-side and left-flipped
placement without dismissing the card; its button remained clickable. Leaving
the card dismissed it; computed entrance animation was `none` with opacity `1`.
The created tab and fixture were removed; existing development servers were kept.
These checks do not establish native Tauri/platform or real remote behavior.

The first full web check failed 11 tests in the unrelated FilePaneNavigation
file, while 5090 tests passed (13 skipped). Its standalone rerun passed all
11 tests without source changes. Final `LANG=en_US.UTF-8 npm run check:web`
passed: 484 files / 5101 tests, with 2 files / 13 tests skipped; TypeScript passed.
`LANG=en_US.UTF-8 npm run test:host` passed, including its Host build/type check:
34 files / 249 tests, with 1 file / 5 tests skipped. `npm run build` passed
with the existing CSS optimizer, mixed-import and large-chunk advisories.
`git diff --check` passed. No commit, push or merge is part of this request.

Installed tool versions read for this follow-up: Node `v24.16.0`, npm `12.0.1`,
Vitest `3.2.7`, TypeScript `5.8.3`, Vite `7.3.6`, Tauri CLI `2.11.4`.
No Rust source changes belong to this request; Rust checks were not run.
Full-suite results include the pre-existing unrelated working-tree changes.

## Shared tab appearance — follow-up validation (2026-10-05)

- [x] Apply one theme-aware bordered/rounded active-tab style to workspace,
  file/terminal, sidebar, app-page and mode/provider navigation tabs.
- [x] Center pills within their rows, retain 30px document tabs and existing
  compact sizes, add decorative inactive document separators and expose the
  selected workspace close action.
- [x] Run affected consumer suites and TypeScript checks; measure actual
  browser spacing and verify selection/actions in light and dark themes.

Affected consumer validation covered 18 files / 285 distinct tests. The first
model-picker run failed its old `rounded-md` class assertion after the appearance
moved to `.surface-tab`; the assertion was updated for the shared class. The
final affected rerun passed 8 files / 91 tests, including all changed workspace
and provider-picker consumers. The other affected consumer files passed on the
initial run. `npx tsc --noEmit` passed. Existing React act warnings occurred in
sidebar/project-tree tests. No unrun full web or Host suite is claimed here.

The browser fixture mounted actual TitleBar and SurfaceTabs with production CSS:
document pills remained 30px with 8px corners; workspace top/bottom gaps both
measured 4.6px and file/terminal gaps both measured 2.6px at the browser's scale.
Light selected surfaces measured RGB 0.9925 and dark selected surfaces 0.1398,
with theme-aware border/text colors. Workspace/terminal selection, the add action
and the selected workspace close callback worked. Proof is saved at
`/tmp/monocode-global-tabs-light.jpg`. The fixture and created browser tab were
removed. Native OS window dragging, real PTY lifecycle and every navigation
surface were not exercised in this browser fixture.

Read tool versions: Node `v24.16.0`, npm `12.0.1`, Vitest `3.2.7`,
TypeScript `5.8.3`, Vite `7.3.6`. No provider/Host/Rust implementation change,
commit, push or merge belongs to this request.

The final `npm run build` passed with the existing CSS optimization, mixed-import
and large-chunk advisories. `git diff --check` passed. Validation included the
pre-existing unrelated working-tree changes; no Rust check was run for this UI
appearance change.

## Compact terminal divider hit area — follow-up validation (2026-10-05)

- [x] Reproduce the full-height raised tab/action wrappers intercepting the
  terminal dock's top boundary.
- [x] Limit raised tab slots to pill height and trailing actions to their
  controls, preserving the shared appearance and equal vertical clearance.
- [x] Verify boundary cursor/hit testing, a drag above a tab, control actions,
  affected tests, TypeScript and production build.

Browser hit testing before the fix returned full-height tab slots above inactive
and active tabs, and the full-height action wrapper above trailing controls,
with cursor `auto`; only blank space returned the separator. After the fix,
all five sampled boundary positions returned the separator with `row-resize`.
Dragging above a tab changed dock height from 220px to 240px. Pills stayed 30px,
with 2.6px top/bottom clearance at the browser's scale. Upper pill hit testing,
selection and the add action remained available. The fixture used the actual
ProjectTerminalDock with production CSS, without native PTY access; it does not
establish real native PTY/window behavior. Proof is saved at
`/tmp/monocode-terminal-divider-fixed.jpg`; the fixture and created tab were removed.

The affected terminal/dock/tab consumer command passed 4 files / 34 tests.
`npx tsc --noEmit`, `npm run build` and `git diff --check` passed; the build
retained existing CSS, mixed-import and large-chunk advisories. No full web,
Host or Rust suite was run for this CSS/hit-region fix. The running desktop's
Vite log recorded HMR updates for ProjectTerminalDock and the shared stylesheet.

## Sessions project scope — follow-up (2026-10-05)

- [x] Reuse the searchable header project picker in multi-project Sessions,
  defaulting to All projects and offering every remembered/current project.
- [x] Activate and expand a concrete selection, scope tree/search/history reads,
  and restore the multi-project tree when All projects is selected.
- [x] Preserve scope across sidebar tabs, reset it on project removal, temporarily
  reveal matching groups without changing their collapse preferences, and retain
  existing Files/Changes and standalone picker behavior.
- [x] Localize the new action and verify selection, keyboard input, current/remote
  projects, group state, navigation and scoped loading in regressions.
- [x] Verify actual browser selection/restoration in zh-CN with production
  Sidebar/picker/CSS, both themes and a narrow sidebar, using simulated IPC.
- [x] Run Host tests and production build; record tool versions and web results.

The affected consumer command initially passed six files; two newly added fixture
errors in ProjectSessionSection were corrected and its 52-test rerun passed.
Full web runs exposed a native-session desktop probe whose
isTauri export was missing from test mocks; the sidebar fixture now explicitly
models a browser environment. FilePaneNavigation also failed to load its editor
in full-suite runs, but its isolated 11-test rerun passed. NativeSessions' isolated
11-test rerun passed without changes from this follow-up. Final equivalent web
validation (`LANG=en_US.UTF-8 npx vitest run --maxWorkers=2` followed by
`npx tsc --noEmit`) passed: 487 files / 5141 tests, with two files / 13 tests
skipped; TypeScript passed. The earlier `npm run check:web` attempts did not pass.

`LANG=en_US.UTF-8 npm run test:host` passed, including the Host build/type check:
34 files / 249 tests, with one file / five tests skipped. `npm run build` passed
with existing CSS, mixed-import and large-chunk advisories. `git diff --check`
passed. Actual tools: Node v24.16.0, npm 12.0.1, Vitest 3.2.7, TypeScript 5.8.3,
Vite 7.3.6 and Tauri CLI 2.11.4.

Browser selection of Android showed only its conversations; returning to All
projects restored the other rows and retained the selected project's expansion.
The selected header's clientWidth and scrollWidth were both 200px. Proof:
`/tmp/monocode-session-project-picker.png` and
`/tmp/monocode-session-project-picker-light.png`. Temporary fixture files, the
created browser tab and preview server were removed. These checks do not verify
native Tauri project/worktree switching or real remote connectivity. No Rust
change, commit, push or merge belongs to this follow-up. Full-suite/build results
include pre-existing unrelated working-tree changes.

## Conversation/project row spacing — follow-up (2026-10-05)

- [x] Reduce dense project/session row gaps and disclosure/member padding from
  4px to 3px, including project groups, folders, pins and reminders.
- [x] Retain the 32px row height, 8px separation between project groups, existing
  standalone/compact spacing and shared two-way disclosure motion.
- [x] Update current spacing requirements and run affected regressions.

Final affected validation passed: `LANG=en_US.UTF-8 npx vitest run
--maxWorkers=2 src/app/shell/ProjectSessionSection.test.ts
src/app/shell/ProjectList.test.ts src/features/projects/ui/ProjectGroups.test.ts`
— three files / 76 tests. `git diff --check` passed. `npm run build` was attempted
and failed TypeScript checking at SettingsView.tsx:3264 (TS6133: unused
onOpenSession in ProvidersPage), an unrelated working-tree edit preserved by
this follow-up. No full web/Host/Rust suite or browser geometry check was run
for this spacing-only change. Earlier successful build results do not establish
that the current working tree builds.

## Focused tab commit verification (2026-10-05)

The user authorized a local commit of the tab appearance, equal spacing,
stronger separators and terminal boundary fix. The sidebar and design records
were staged from HEAD with only these changes; unrelated project-tree, Host,
native-session and mobile work remains outside the commit.

An isolated checkout of the staged source passed 16 affected test files / 207
tests and `npm run build` (including TypeScript), with existing CSS optimization,
mixed-import and large-chunk advisories. `git diff --cached --check` passed.
The separator now uses content color at 22% opacity while keeping its 1px width,
12px height and pointer-transparent behavior. Earlier browser/working-tree
results remain separate from this isolated commit validation. No push or merge
was requested.

## Project scope and spacing — local commit verification (2026-10-05)

The user authorized a local commit of the conversation project picker and 1px
spacing reduction. The commit includes the necessary multi-project sidebar
foundation, project history/cache loading, extracted session sections and their
existing shared hover/disclosure dependencies. Mixed App, connection, translation
and design records were staged selectively from HEAD. Host orchestration, native
session upgrades, SettingsView, Rust, mobile edits and the active-feature pointer
remain outside this commit, including the new ExternalSessions sidebar integration.

An independent checkout containing only the proposed commit passed 18 affected
test files / 298 tests. The full connection consumer directory additionally passed
13 files / 85 tests; this overlaps the remote-project cache file from the affected
group and the totals must not be added. `npm run build` passed, including TypeScript,
with existing CSS, mixed-import and large-chunk advisories. The staged diff check
passed. These results are separate from the earlier full working-tree runs and
the settings-page TypeScript failure. Native/platform and real remote scenarios
remain unverified. No push or merge was requested.

## Five-row Show more steps — follow-up (2026-10-05)

- [x] Replace the dense project tree's full-list toggle with per-project limits:
  start with five rows, add five per click, and retain Show more until the final
  remainder is visible. Disable automatic scroll loading for this mode.
- [x] Show less restores the initial preview while keeping the active session
  visible. Reuse AnimatedCollapse for revealed rows, closing lifetime, inert
  content, rapid reversal and reduced motion; empty row shells leave no gaps.
- [x] Preserve folders, existing pin behavior, search and standalone paging;
  update requirements/design records and affected regressions.
- [x] Run affected regressions, formatting/diff checks and the production build.

Validation passed: `LANG=en_US.UTF-8 npx vitest run --maxWorkers=2
src/app/shell/ProjectSessionSection.test.ts src/app/shell/ProjectList.test.ts
src/features/projects/ui/ProjectGroups.test.ts
src/shared/ui/AnimatedCollapse.test.ts` — four files / 81 tests. Coverage includes
5 → 10 → … → 40 → 43 rows, no scroll sentinel, the final remainder, animated
closing, reversal, active-session retention, folders, short lists and search.
The initial expanded fixture failed because equal timestamps sort titles
lexically after row 9; descending fixture timestamps fixed its intended order.
Prettier and `git diff --check` passed. `npm run build` passed including
TypeScript, with existing CSS, mixed-import and large-chunk advisories.
Actual tools: Node v24.16.0, npm 12.0.1, Vitest 3.2.7, TypeScript 5.8.3, Vite
7.3.6. Results include the current working tree's unrelated edits. No full
check:web, Host/Rust suite or browser/native geometry scenario was run for this
UI follow-up. No commit, push or merge was requested.

## General UI responsiveness — follow-up (2026-10-05)

- [x] Replace SessionPane's global native-session subscription with per-session
  access snapshots. Lease renewal timestamps still update and expire after the
  latest 15-second check; unrelated discovery and unchanged ownership checks do
  not redraw panes. Reuse the poll's probe without removing Host busy, manual-title
  or canonical-deletion guards.
- [x] Group project-tree history/live sessions once and share the global
  worker/inbox overlay context, preserving path aliases, pins and sort behavior.
- [x] Pause hidden/offscreen/document-hidden arcade and composer animation loops,
  preserve their state on return and respect reduced motion. Cache grid geometry,
  stamp buffers and border paths; retain both board paints during slides and draw
  borders after fills. Keep default arcade behavior and running terminals mounted.
- [x] Verify affected consumers, static rendering, ownership expiration, model
  behavior and bounded performance fixtures; build the current working tree.

Controlled React consumer checks with 39 mounted panes reduced additional renders
on an unchanged native poll from 39 to zero. An ownership change redraws only its
pane, and the latest lease still becomes read-only after expiry. Each non-busy
poll now obtains one native probe rather than two.

A read-only Host summary benchmark used 1192 stored rows across 111 projects and
39 synthetic open sessions with 5000 blocks each. Equivalent old/new history
outputs were checked. Eight samples per implementation gave median overlay time
37.85ms before and 2.55ms after. This measures the history helper, not an entire
native click or App render.

The controlled 39-mounted-tab, one-visible-tab animation experiment over ten
frames reduced animation callbacks from 390 to 10, synchronous layout reads from
390 to zero, and board paints from 20 to 10. Per-cell strokeRect calls fell from
80080 to zero because a cached Path2D now receives one stroke per painted board;
the grid still renders. These counts exclude mount/resize work.

An isolated production-React Chrome fixture mounted 40 pane backgrounds/runners
with one visible pane and switched tabs using 24 actual browser button clicks per
implementation. It compared the former grid/runner implementations from HEAD
with the new implementations, retaining the other fixture code. The click event
timestamp to two requestAnimationFrame callbacks was used as a paint proxy:
median 47.25ms before / 31.15ms after, p95 94.8ms / 78.1ms. Animation callback
rates were approximately 2395/s / 86/s and synchronous layout-read rates 757/s /
11/s over unequal observation windows (16.17s / 13.85s). Neither run recorded a
long task. These samples measure the fixture rather than the complete desktop,
physical input latency or Event Timing INP. Native Tauri/WebKit timing remains
unverified; the earlier commentary's estimated 51ms / 27ms medians were corrected
by sorting the recorded samples. The temporary server/tab/files were cleaned up.

Final focused validation passed, with 154 distinct tests across these groups:

- `npx vitest run src/features/sessions/data/nativeSessions.test.ts` — 27 tests.
- `npx vitest run src/features/sessions/ui/AgentTranscriptSessionAccess.test.ts
  src/features/settings/ui/NativeSessionsPanel.test.ts
  src/features/workspace/ui/PaneTreeSurfaces.test.ts` — 23 tests.
- `npx vitest run src/features/sessions/data/sessionHistory.test.ts` — 31 tests.
- `npx vitest run src/features/terminal/ui/TerminalGridBackground.test.ts
  src/features/sessions/ui/ComposerRunner.test.ts
  src/features/sessions/ui/EmptySession.test.ts` — ten tests.
- `npx vitest run src/features/terminal/arcade/pacmanArcade.test.ts
  src/features/terminal/arcade/snakeArcade.test.ts
  src/features/terminal/arcade/gridGames.test.ts
  src/features/sessions/model/composerRunner.test.ts` — 63 tests.

An initial EmptySession static-render consumer check failed because the new
activity initializer read document during Node rendering. Lazy initialization
with browser-global guards repaired it; the final ten-test UI group passed.
`npx tsc --noEmit`, `npm run build` (including TypeScript), and `git diff --check`
passed after the code repairs. Vite built 3573 modules with existing CSS,
mixed-import and large-chunk advisories. Actual tools: Node v24.16.0, npm 12.0.1,
Vitest 3.2.7, TypeScript 5.8.3 and Vite 7.3.6. Results include unrelated edits in
the current working tree. No full web/Host/Rust suite, native runtime reload,
commit, push or merge belongs to this UI follow-up. Earlier Host/parser repairs
and their checks remain recorded in specs/021-multi-agent-session-sync.

## Requested production desktop build — verification (2026-10-05)

The user requested the complete production desktop after confirming the running
window used Tauri dev/debug. `npm run build:linux -- --ci` passed, including the
desktop Host package and its executable version smoke check, TypeScript and Vite
production assets, Rust's optimized Release profile, and both Linux x86_64 bundles:

- `target/release/monocode`
- `target/release/bundle/deb/MonoCode_0.7.0_amd64.deb`
- `target/release/bundle/appimage/MonoCode_0.7.0_amd64.AppImage`

The actual .deb archive was unpacked and its seven Host resources matched the
build input. Its package metadata is mono-code 0.7.0 / amd64. The final AppImage
was fully extracted successfully; its six unchanged Host/manifest/license/launcher
resources matched the build input. Its Node binary has linuxdeploy's expected
RUNPATH modification, with unchanged .text/.rodata sections. Both packages execute
their bundled Node as v24.21.0 and Host --version as 0.7.0. Release/AppDir desktop
and Node dependency checks found no missing libraries. Temporary extractions were
cleaned up. File times, sizes, SHA-256 and actual build tools are recorded in
target/release/desktop-build-info.json, replacing the stale prior build record.

Actual Rust/Cargo: 1.96.0; Tauri CLI: 2.11.4; Tauri Rust: 2.11.5. Node/npm/Vite
remain as recorded above. Existing CSS, mixed-import and chunk-size advisories
were non-fatal. No source repair was necessary for this build. The production
artifacts include the current unrelated working-tree changes. This scope did not
install or launch the desktop, switch the running dev window, restart the Host,
measure native response, publish, commit, push or merge. No additional test suite
was run for the build-only request.

## Production startup responsiveness — follow-up (2026-10-05)

- [x] Inspect the installed production runtime and distinguish startup recovery
  from persistent interaction delay using the user's confirmation and bounded
  process samples.
- [x] Cache binding/scope decoding by serialized storage value; preserve
  cross-window updates, malformed-storage recovery and failed-write behavior.
- [x] Defer unvisited hidden pooled transcripts, retaining first-show, revisit,
  pool/session identity and host handoff behavior.
- [x] Coalesce concurrent Host descriptor/catalog reads by identity scope,
  retaining independent session sync and stale/disposed guards.
- [x] Run relevant regression tests, TypeScript and focused diff checks; perform
  independent read-only review of the cache, pool and metadata changes.
- [x] Rebuild and inspect the production desktop packages containing these fixes.
- [ ] Measure the updated installed desktop's native startup responsiveness.

The installed /usr/bin/monocode matched the previous .deb's staged binary, so the
reported window was production. The user clarified that delay mainly occurs
immediately after launch. Early lifetime CPU percentages included startup; a
later ten-second user-space CPU-clock profile sampled about 0.808 CPU seconds in
WebKit (80 samples, no lost samples). Most samples were in JavaScriptCore, but
stripped frames and this later observation do not establish a specific startup
stack or prove that every source of delay has been found.

Read-only inspection of the production origin found 1193 persisted bindings.
The previous per-row lookup decoded the whole table each time. A Node/happy-dom
benchmark using that serialized table (nine samples) measured median 223.321ms
for 1193 lookups before caching versus 0.053ms with a warm parsed cache; 195
lookups measured 36.818ms versus 0.023ms, or 0.337ms including the first parse.
These are helper timings, not native WebKit or complete startup timings.

The controlled 39-pane restoration regression mounted 39 transcripts before the
fix and one after it. Visiting a second pane mounted one more transcript;
returning to the first reused it. Existing visited-hidden, same-session host
handoff and pool identity behavior remain covered. A separate 39-RemoteSession
consumer regression reduced environment.describe and models.list from 39 calls
each to one each while preserving all 39 sessions.sync requests and onSnapshot
callbacks. Sharing ends when the request settles; failure retries and different
machine/environment/project scopes are covered.

Focused validation passed with 97 distinct tests:

- `npx vitest run src/features/connections/model/remoteBindings.test.ts
  src/features/connections/model/sharedHost.test.ts
  src/features/connections/model/retiredOutbox.test.ts` — 15 tests.
- `npx vitest run src/features/sessions/ui/TranscriptPool.test.ts` — 11 tests.
- `npx vitest run src/features/connections/model/remoteHostMetadata.test.ts
  src/features/connections/ui/RemoteSession.test.ts` — 43 tests. An existing
  running-turn case printed React act advisories but passed.
- `npx vitest run src/features/sessions/ui/AgentTranscript.firstPaint.test.ts
  src/features/sessions/ui/AgentTranscriptScroll.test.ts` — 28 tests.

`npx tsc --noEmit` and focused `git diff --check` passed. No provider protocol,
Host or Rust source was changed by this startup follow-up; unrelated working-tree
changes remain. No full-suite result, native speedup, install, process restart,
commit, push or merge is claimed.

The follow-up `npm run build:linux -- --ci` passed, including the desktop Host
package, frontend TypeScript/Vite and optimized Rust Release build. Both the .deb
and AppImage were unpacked successfully. All seven .deb Host resources and the
six AppImage resources excluding linuxdeploy's patched Node matched the build
inputs. Both bundled runtimes reported Node v24.21.0 and Host 0.7.0; release
desktop library resolution found no missing dependencies. Temporary extractions
were removed. Updated package sizes, SHA-256 and verification results are in
target/release/desktop-build-info.json. The packages still use version 0.7.0 and
include the working tree's other changes. The user's installed running desktop
was not replaced or restarted; updated native startup timing remains unverified.

Commit isolation verification (2026-10-05): the startup changes were extracted
onto an archived HEAD tree without the unrelated pending Host, scope/retirement,
mobile or orchestration features. The independent binding-cache change retains
HEAD's existing binding API; scope-specific extensions remain with their other
working-tree changes. Seven relevant suites passed 87 tests: remoteBindings (5),
remoteHostMetadata (4), RemoteSession (33), sharedHost (6), TranscriptPool (11),
AgentTranscript.firstPaint (3), and AgentTranscriptScroll (25). The isolated
`tsc --noEmit` also passed. The existing running-turn act advisories remained.
This separately validates the selected commit contents; the earlier 97-test and
production-package results refer to the complete working tree.

## Conversation sidebar grouping — follow-up (2026-10-05)

- [X] Add the mixed Pinned section and explicit Projects heading with independent
  five-entry previews. Preserve configured project avatars and provider icons
  in both project children and pinned shortcuts (user clarification).
- [X] Preserve shortcut selection, unpin actions, search, collapsed-project access,
  shared collapse motion and project-scoped Host/native routing.
- [X] Verify focused sidebar regressions: ProjectList (22), SidebarRename (45),
  ProjectSessionSection (55) passed. The first combined run passed 121 tests; after
  adding the Host shortcut regression, the affected 55-test suite passed again.
  `npx tsc --noEmit --pretty false` and `git diff --check` passed. Existing React
  act advisories were printed by the sidebar suites. Native desktop visual review
  and rebuilding/installing the production app were not performed.

## Session folder removal — follow-up (2026-10-05)

- [X] Flatten existing session folders without deleting conversations; preserve
  blank open Host sessions, pins, reminders, search, selection and pagination.
- [X] Remove drag grouping, folder menus, composer picker/command and prop
  plumbing, automation folder destinations and Operator/desktop CLI actions.
  Keep legacy persisted metadata readable but inactive in the desktop UI.
- [X] Update sidebar, command and CLI regressions and the current README/contract.
- [X] Run proportional checks and record actual results:
  - Seven affected Vitest suites passed 185 tests: ProjectSessionSection,
    SidebarRename, agentApp, Composer, ComposerRunner, PaneTreeSurfaces and
    automations. After adding command-removal coverage, Composer (40 tests)
    and SkillPicker (1 test) passed; 187 distinct Web tests across eight suites.
  - `npx tsc --noEmit` and `git diff --check` passed. Existing sidebar React
    act advisories remain.
  - `npm run check:rust` was attempted. After correcting the CLI action-array
    length, the latest run stopped at an unrelated pre-existing formatting
    difference in `src-tauri/src/session_store.rs:43`; full Rust validation
    is not claimed. `cargo test control_cli` passed six targeted CLI tests.
  - Native desktop visual validation and rebuilding/installing the production
    app were not performed. No provider protocol or compatibility claims.

## Recent sidebar projects and conversations — 2026-10-05

- [X] Sort ordinary projects by last opened time; preserve manual pins/groups
  and disable drag ordering for recent projects.
- [X] Add Recent sessions shortcuts with global update-time ordering, project
  scope/search/filters, open blank chats and canonical Host identity.
- [X] Load missing collapsed-project summaries at bounded concurrency without
  starting Host polling; reuse five-item previews and shared collapse motion.
- [X] Run affected sidebar/project regressions and TypeScript; record results.

Focused validation passed across six suites / 153 distinct tests: recents (15),
ProjectList (23), ProjectSessionSection (62), SidebarRename (45), ProjectGroups
(3) and AnimatedCollapse (5), using `LANG=en_US.UTF-8 npx vitest run
--maxWorkers=2`. Coverage includes reopened-project order, collapsed-project
selection, native/Host routing, provider/time/archive/status filters, scope,
independent five-row previews, closing/reversal, language switching and stopping
queued reads on close/tab change/unmount. Earlier assertions that inspected the
whole sidebar for collapsed rows were scoped to project children. A later
combined run exposed an empty recent-search hint while loading; recentPending
fixed it and the final affected ProjectList/ProjectSessionSection run passed
all 85 tests. The other four suites' latest runs passed all 68 tests.

`npx tsc --noEmit --pretty false` and `git diff --check` passed. A whole-file
Prettier check reported differences in five already-edited files; the added
recent-conversation/loading test block was formatted with a bounded range to
preserve unrelated formatting. No full web/Host/Rust suite, browser/native
visual review, production rebuild/install, provider compatibility scenario,
commit, push or merge was performed for this follow-up.

### User-requested closeout verification — 2026-10-05

The sidebar implementation and previously adapted project-child assertions
were retained. Closeout added two consumer regressions for the Recent sessions
entry: local rename/pin/unpin/archive/delete without project activation, and
Host mutations scoped to beta-host when alpha-host has the same session ID.
Host request assertions cover all five operations, refreshes and the scoped
deletion notification; they do not exercise a real networked Host. An initial
new test failed because nested async act deferred its menu render. Awaiting
the actual menu/input interactions fixed the test helper without product edits.

One final combined run passed six files / 155 tests, zero failures:

```sh
LANG=en_US.UTF-8 npx vitest run --maxWorkers=2 --silent --reporter=json \
  --outputFile=/tmp/monocode-recents-closeout-tests.json \
  src/features/projects/model/recents.test.ts \
  src/app/shell/ProjectList.test.ts \
  src/app/shell/ProjectSessionSection.test.ts \
  src/app/shell/SidebarRename.test.ts \
  src/features/projects/ui/ProjectGroups.test.ts \
  src/shared/ui/AnimatedCollapse.test.ts
```

Counts: recents 15, ProjectList 23, ProjectSessionSection 64, SidebarRename 45,
ProjectGroups 3, AnimatedCollapse 5. Existing project switching and scope,
canonical blank Host shells, duplicate Host IDs, local native/remote opening,
five-row reveals, two-way closing lifetime/inertness, rapid reversal and reduced
motion checks all remain and passed. Original session rename/keyboard/selection,
archive, metadata/link and reminder regressions also passed.

`npx tsc --noEmit --pretty false` exited zero. Focused `git diff --check` passed.
Source fingerprints taken at closeout showed no changes outside
ProjectSessionSection.test.ts before this validation-record update, protecting
the other sessions' working-tree edits. No product source repair was needed in
this closeout. There is no blocker to completing the requested source/UI scope.
Native desktop visual review, real Host connectivity and production packaging
remain unverified; no rebuild/install, commit, push or publication was performed.

The final fingerprint recheck subsequently observed concurrent updates to
specs/022-host-assistant/compatibility.md and specs/022-host-assistant/tasks.md.
This closeout did not write those files and preserved their new contents. The
earlier unchanged-file observation refers to the audit before this record update;
no unrelated product source changed during the completed checks.

## Project clicks during search — 2026-10-06

- [x] Reproduce project-name clicks leaving search matches expanded and project
  disclosures returning without changing state; establish failing regressions.
- [x] Keep explicit search folds local to the current query, restore persisted
  expansion after clearing, retain activation on reopening, and reopen for chat
  creation/scope selection. Reuse AnimatedCollapse without new motion timers.
- [x] Verify affected tests, TypeScript and isolated real-pointer fixtures.

The two new search regressions failed against the original implementation.
Final focused validation passed 95 tests across ProjectSessionSection (67),
ProjectList (23) and AnimatedCollapse (5), using `LANG=en_US.UTF-8 npx vitest run
--maxWorkers=2 --silent=true` with those three paths. Coverage includes names,
row backgrounds, disclosures, independent project folds, query reset, saved
expansion, rapid reversal, inert closing content and chat creation. `npx tsc
--noEmit` and focused `git diff --check` passed. The initial baseline test command
used ambiguous `--silent` placement and exited before running tests; corrected
`--silent=true` runs produced the results above. Only the added test range was
formatted to preserve existing edits.

Chrome 154.0.8037.97 reproduced unchanged expansion from an actual name click
with a search query. After the repair, settled-layout runs passed 30 Chrome
name clicks and 60 WebKitGTK 2.52.6 name clicks during search. Earlier coordinate
runs begun while filtering was still changing layout missed two Chrome clicks
and one WebKit click; the settled runs avoid that setup ambiguity and do not
prove clicks on moving targets are reliable. No-query baseline fixtures passed
30 arrow/30 name clicks in each engine and 60 full-Sidebar WebKit name clicks.
These isolated fixtures used synthetic projects/history, not the user's live
desktop or real Host connections. Temporary fixture files, browser tab and
server were cleaned up.

The user identified project names/whole rows but has not confirmed whether a
search query is present. Frequent no-query failure remains unreproduced; this
repair addresses the confirmed search condition. The running stable-mode Tauri debug desktop
was not reloaded or restarted. No production build/install, full web/Host/Rust
suite, provider scenario, commit, push or merge was performed. The unrelated
working-tree changes remain intact.

## More visible project disclosure motion — 2026-10-06

- [x] Inspect the motion curve and measure real project-section frames.
- [x] Apply 420ms balanced height/fade motion to project-tree/group sections and
  rotate stable chevron SVGs; reuse the shared lifecycle and reduced motion.
- [x] Verify custom-duration closing lifetime/reversal, affected consumers and
  real Chrome/WebKit animation frames; preserve unrelated working-tree edits.

In the controlled five-row Chrome fixture, the prior 340ms ease-out completed
about 74% of its height change by 80–85ms. The new 420ms curve completed about
12% by the same point and continued visibly through the middle of the motion.
Chrome 154.0.8037.97 and WebKitGTK 2.52.6 both recorded intermediate opening and
closing heights and rotation matrices, settling at 172px/0px and 90/0 degrees.
Chrome's reduced-motion check showed immediate settled states and a zero-second
chevron transition. Fixtures are isolated synthetic UI, not the running desktop.

Focused Vitest checks passed 100 distinct tests across AnimatedCollapse (7),
ProjectList (23), ProjectSessionSection (67) and ProjectGroups (3). The first
four-suite run exposed a group-mascot mounting regression; preserving the
original collapsed-only mascot mount fixed it, and the affected ProjectGroups
and ProjectList rerun passed all 26 tests. Custom duration tests verify that
closing content survives past the default timeout, reversal cancels the old
timeout, and reduced motion remains immediate. TypeScript, Prettier for the
shared helper/tests and changed group range, and focused diff checks passed.
Temporary fixture files, browser tab and Vite server were cleaned up.

No global default-duration or grid-panel behavior changed. No full suite,
Host/Rust checks, production rebuild/install, live desktop reload, commit, push
or merge was performed. Earlier search-click fixes and unrelated edits remain.
