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
