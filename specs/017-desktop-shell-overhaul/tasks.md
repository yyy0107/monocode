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
