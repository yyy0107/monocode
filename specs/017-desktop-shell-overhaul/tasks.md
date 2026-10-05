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
