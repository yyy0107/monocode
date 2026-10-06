# Tasks

- [x] Switch the running primary action to Send for pending content.
- [x] Update existing send/stop checks and enabled-menu focus expectations.
- [x] Run mobile tests and attempt the mobile production build; record results and blockers.

## Validation evidence — 2026-10-04

- Node v24.16.0, npm 12.0.1, TypeScript 5.8.3, Vite 7.3.6 and Vitest 3.2.7.
  No provider CLI or protocol changes.
- Composer, keyboard motion, message queue and queued-draft checks:
  4 files, 60 tests passed. Running drafts submit through Send without canceling;
  clearing restores Stop. Existing queue shortcuts and configuration locks pass.
- Initial composer run: 26 passed, one existing popup focus expectation failed
  because the newly added disabled skills row was counted as focusable. Updating
  that test's selector to enabled rows matches the existing popup focus handler.
- Full mobile suite: 31 files passed, 3 failed; 292 tests passed, 9 failed,
  6 unhandled errors. Failures are in activityUi, client and projectPickerFlow:
  cachedModels/cachedSession mocks are missing, navigation assertions fail, and
  client image-preview hydration expects bytes that are no longer hydrated there.
  These involve the checkout's other loading/cache changes and remain unresolved.
- `npm run mobile:build` attempted; TypeScript stopped before bundling with
  TS2345 at MobileApp.tsx:435 (optional cached catalog) and TS2454 at client.ts:486
  (`pending` used before assignment). Those files already had unrelated local
  changes and were preserved.
- `git diff --check` passed. No physical-device or real-provider run, Host/Rust
  checks, deployment or publication was performed for this composer UI change.

## Android typing focus follow-up — 2026-10-05

- [x] Add shared touch-end focus protection to the composer and its sheets,
  retaining native scrolling, drag handling, one activation per tap and cleanup.
- [x] Cover touch sequences, caret retention, duplicate clicks, rapid taps,
  permission changes, editable/unfocused controls, sending/stopping and gestures.
- [x] Run mobile tests, mobile production build and check:web; record results.
- [x] Validate actual Chromium touch input against MobileComposer and its sheets.
- [ ] Verify a physical Android App with its IME open: menus never lower the
  keyboard or move the composer downward; typing continues after dismissal.

### Validation evidence

- Node `v24.16.0`, npm `12.0.1`, TypeScript `5.8.3`, Vite `7.3.6`,
  Vitest `3.2.7`. No provider CLI or protocol was changed or exercised.
- The 41 existing composer/sheet/keyboard tests passed before changes. Seven
  touch-sequence regressions failed before the shared hook and passed after it.
  A drag-consumption regression also failed until consumed movement cancelled
  tap activation.
- Final `LANG=en_US.UTF-8 node node_modules/vitest/vitest.mjs run src/mobile`
  passed: 39 files, 342 tests, including the ten new touch focus behavior checks
  and the additional touch submission/stop regression.
- `npm run mobile:build` passed, including both TypeScript checks and Vite.
  Existing CSS `::highlight` optimizer and chunk-size advisories remain.
- `LANG=en_US.UTF-8 npm run check:web` failed: 486 files passed, two skipped,
  one failed; 5122 tests passed, 13 skipped, 11 failed with 11 unhandled errors.
  Every failure is in the already-modified nativeSessions.test.ts: its Tauri
  core mock lacks `isTauri`, and failed setup also leaves cleanup undefined.
  Those unrelated native-session files were preserved. The script stopped
  before its TypeScript stage; the mobile build's TypeScript checks passed.
- Headless Chromium `153.0.8010.12`, 390×844 mobile touch emulation: actual trusted
  taps opened/closed all three menus with zero textarea blur and unchanged draft
  and selection. Native touch input scrolled the 50-model list without selecting
  a model. Model/reasoning/permission changes each activated once; photo upload
  opened the browser file chooser; an unfocused composer did not acquire typing
  focus. The fixture used the actual components and production CSS with local
  props; it did not exercise a Host connection or an Android IME.
- Physical Android IME/device validation is pending. No Host/Rust checks,
  application installation, publishing, pushing or merging was performed.
- Final `git diff --check` passed. The temporary browser fixture/server closed
  after verification; unrelated working-tree changes and the active feature
  pointer were preserved.

## Reference card layout follow-up — 2026-10-05

- [x] Replace the focus-driven capsule with the reference context band, input
  surface and bottom toolbar, preserving existing actions and touch focus.
- [x] Keep draft project selection available and existing session projects fixed;
  reuse shared attachment disclosure motion and preserve multiline autosizing.
- [x] Run affected existing checks and mobile-width browser inspection; record
  actual results and any physical-device validation limits.

### Validation evidence

- Node `v24.16.0`, npm `12.0.1`, TypeScript `5.8.3`, Vite `7.3.6`,
  Vitest `3.2.7`; no provider/Host/Rust protocol changes or CLI compatibility run.
- Focused checks used `LANG=en_US.UTF-8 node node_modules/vitest/vitest.mjs run`
  with composer, mobileSkillsFlow, projectPickerFlow, MobileSheet and inputFocus:
  initial 50 tests passed, final five-file run 52 tests passed. Intermediate
  composer/skills checks passed 32 tests; after moving retained attachment data
  into the shared disclosure's child, the composer-only 26 checks passed again.
  Coverage includes send/stop/queue, project locks, skill insertion, touch focus,
  keyboard dismissal, autosizing, closing interaction locks, rapid reopening
  and reduced motion. Obsolete single-row capsule expectations were replaced.
- `node node_modules/typescript/bin/tsc --noEmit` passed during implementation.
  `LANG=en_US.UTF-8 npm run mobile:build` passed both TypeScript checks and Vite.
  Vite bundling was repeated after the final Chinese label update and passed;
  the generated mobile bundle includes that label. Final `git diff --check` passed.
  The existing `::highlight` CSS optimizer and chunk-size advisories remain.
- Chrome `154.0.8037.97`, actual component and production CSS with local preview
  props: inspected 390×844 light and 320×740 dark layouts. The 320px long-draft,
  long-project, plan and running/queue case stayed inside the card; drafts wrap
  and scroll, the model label remains readable, and the toolbar does not overflow.
  The empty card is 174px tall at 390px. Trusted touch taps opened model, add,
  permissions, project and commands sheets with zero textarea blur and unchanged
  selection (5–9). Closing sheets and attachments were inert during their shared
  exit animations; attachment chips disappeared afterward. Reduced motion sets
  the textarea transition to zero. The preview used no Host connection.
- Physical Android/iOS keyboard validation remains unrun. The temporary preview
  files, browser tab and server were removed/closed; unrelated checkout changes
  and the active feature pointer were preserved. No installation, publishing,
  pushing or merging was performed.

## Keyboard anchor follow-up — 2026-10-05

- [x] Follow moving button anchors while sheets are open; release frame tracking
  on close/unmount and preserve fixed point menus.
- [x] Regress movement without resize/scroll, reversal, reopening and cleanup;
  run focused tests, TypeScript and actual-component browser simulation.

### Validation evidence

- The new movement regression failed before the fix: the panel retained a 308px
  bottom offset when the moving trigger required 248px. It passed after the fix.
- `LANG=en_US.UTF-8 node node_modules/vitest/vitest.mjs run` with MobileSheet,
  composer, keyboardMotion, sheetDrag, modelControls, mobileSkillsFlow and
  projectPickerFlow passed: 7 files, 68 tests.
- `node node_modules/typescript/bin/tsc --noEmit` and `git diff --check` passed.
- Chrome `154.0.8037.97`, 390×844, actual MobileComposer and production CSS:
  simulated keyboard dismissal, rise/reversal, restoration from a 390×544 resized
  viewport and reduced motion. The panel-to-trigger gap remained 8px within
  0.013px across sampled frames; textarea focus and selection (5–9) were retained.
  The preview used local props, with no Host connection or physical Android IME.
- Temporary preview files/tab were removed; the existing dev server and unrelated
  working-tree changes were preserved. No build, installation or publication.
