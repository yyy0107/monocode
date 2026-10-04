# Tasks

- [x] Separate readable-content visibility from automatic scroll following.
- [x] Raise the mobile button above images and consume its input events.
- [x] Verify scrolling, content growth, composer resizing and image hit testing.
- [x] Run affected regressions, web checks and production builds; record results.

## Validation evidence — 2026-10-04

- Node v24.16.0, npm 12.0.1, TypeScript 5.8.3, Vite 7.3.6 and
  Vitest 3.2.7. No provider CLI or protocol changes.
- Focused transcript scrolling, prompt-rise, first-paint and mobile interaction
  regressions: 26 passed across four files, including both scroll-follow modes,
  visible content with trailing blank space, content growth, dock insets, event
  propagation and focus. Repeated successfully after the final guard against
  measuring a detached transcript.
- `npm run check:web`: passed before that final detached-transcript guard;
  4,587 tests passed, 13 skipped, 442 passing files and two skipped files;
  TypeScript checking passed. The final source passed `npm run build` and
  `npm run mobile:build`, including TypeScript checking. Existing chunk-size
  and CSS highlight warnings remain. `git diff --check` passed.
- Browser fixture used the actual MobileTranscript and MobileComposer in a
  390×844 viewport. A visible latest reply stayed button-free after scrolling
  up. At a fixed scroll position, the end at 750px was visible above the
  collapsed dock at 770px; expanding the dock to 716.4px displayed the button.
  Growing the reply past the dock displayed the button while the latest turn
  remained 670px tall and scrollTop remained 1824.8px.
- Actual hit testing over an attachment image selected `.mobile-jump`.
  Clicking it scrolled to the latest message, preserved TEXTAREA focus and
  did not open the image dialog. Screenshot: `/tmp/monocode-jump-control.jpg`.
  The temporary fixture was removed and its browser viewport restored.
- Native Android/iOS device interaction was not exercised. No Host or Rust
  implementation changed in this task, so their checks were not run. Existing
  and concurrently arriving unrelated changes were preserved. No publication,
  push or merge.
