# Tasks and evidence

- [x] Review the 21 upstream-only commits against fork and live UI changes.
- [x] Pi model discovery, review mode, model focus and question Back ports.
- [x] Attachment lifecycle and localized owned errors.
- [x] Folder actions, literal pathspecs and disclosure adaptation.
- [x] Selective scroll repairs preserving shared mobile behavior and text reveal.
- [x] Focused regressions and independent review.
- [x] Combined web tests and TypeScript check.
- [x] Combined Host build/type check and tests.
- [x] Combined production build.
- [x] Rust fmt, all-target clippy and tests for the folder port.
- [x] Integrate reviewed commits while preserving unrelated main-checkout work.

## Executed focused validation

- Pi catalog and protocol: 28 tests passed, including Pi extension loading and
  retained OMP extension isolation.
- Small UI fixes: 83 tests passed across 8 files; TypeScript passed. Coverage
  includes Markdown/SVG ordinary/review mode independence, focus in both entry
  paths, and returning to fork multiline questions with preserved input values.
- Attachment port: 83 tests passed across 5 files; TypeScript passed. Coverage
  includes combined paste/drop waiting, stale URL revocation, capability changes,
  native/browser deduplication, platform coordinates and live Chinese errors.
- Folder port: 143 affected UI/localization/motion tests passed. Complete Host
  suite passed: 198 tests in 28 files, 1 file/5 tests skipped; Host build and type
  check passed. Both TypeScript checks passed.
- Folder Rust validation: cargo fmt and all-target clippy passed; cargo test
  passed with 518 tests and 1 ignored. Tauri resource discovery used a read-only
  link to the existing packaged desktop Host; no source resource path changed.
- Selective scroll port: 169 tests passed in 12 files, TypeScript passed. Added
  regressions failed in 11 cases before repairs; omitting programmatic anchor
  geometry recording additionally failed both touch-mode cases. Existing mobile
  scroll, prompt/jump motion, first paint, search and output-pacing tests passed.
- Independent review of small UI and attachments found no actionable regressions;
  an additional 64 focused integration tests passed.

Tool versions: Node `24.16.0`, npm `12.0.1`, Vitest `3.2.7`, TypeScript `5.8.3`,
Git `2.53.0`, Rust/Cargo `1.96.0`. Installed provider CLI version probes returned
Pi `1.0.3` and OMP `18.6.0`; no live model/extension session was run.

Native Tauri drag/drop and visual animation QA, macOS and Windows were not run.

## Combined validation

- `LANG=en_US.UTF-8 npm run check:web` passed: 468 files / 4916 tests;
  2 files / 13 tests skipped; TypeScript passed. The first run exposed the
  pre-existing blur-navigation fixture flake already recorded by the shell
  overhaul. The fixture now assigns initial disk content explicitly and checks
  its one-line state, rather than consuming the next generic IPC response.
  Its 11 focused tests and the complete rerun passed.
- `LANG=en_US.UTF-8 npm run test:host` passed, including Host build/type check:
  28 files / 198 tests passed; 1 file / 5 tests skipped.
- `npm run build` passed; existing CSS optimizer and bundle-size advisories remain.
- Integrated Rust/Host workspace source hashes exactly match the separately
  validated folder worktree. No Rust source changed after its fmt/clippy/test run.
- These complete checks apply to the isolated committed integration tree,
  excluding other unfinished work in the live main checkout.

## Main-checkout integration

The selected code commits were integrated through four bounded fast-forwards
ending at `edbeba8`, with backups and checks of HEAD, index and affected working
files. The editor-resource leasing changes, remote orchestration composer fields
and existing dictionary additions remained unstaged; unrelated tracked/untracked
work was not included in these commits. The real index remained free of staged
changes after integration.

After integration, 206 focused tests in 12 files passed on the live main checkout,
including its unfinished editor-resource and remote orchestration changes.
No commits were pushed. Native/live-provider QA limits above still apply.
