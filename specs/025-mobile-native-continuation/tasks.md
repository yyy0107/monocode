# Tasks

Tasks remain unchecked until the implementation and its stated validation have
actually completed. Automated checks do not complete manual provider or phone
acceptance scenarios.

- [x] T001 Inspect constitution, feature 021 and shared-session contracts; record
  the dirty-workspace baseline and bounded mobile continuation requirements.
- [x] T002 Add regression coverage for old paired Hosts that support shared
  desktop/orchestration but omit native continuation, including idle replacement,
  preservation of credentials/history and refusal to replace a busy Host.
- [x] T003 Advertise public/private native capability and require it in the Node
  desktop-bootstrap capability check reused by Rust preparation.
- [x] T004 Add mobile regressions for checking, older Host, transient request
  failure, external/ambiguous/MonoCode owner, unsupported platform, session/Host
  switching with an in-flight probe, and running native mirror ownership.
- [x] T005 Implement the mobile access state and localized feedback while
  preserving existing Host-owned turn controls and strict writable gating.
- [x] T006 Add active native mirror regressions and prevent desktop-native
  refresh from overwriting a running Host turn or clearing its running status.
- [x] T007 Verify Host lock/ownership and strict native ID regressions for
  Claude Code, Codex, Pi, omp and OpenCode without weakening provider checks.
  Fix the discovered probe-release race and cover delayed lock-holder exit.
- [x] T008 Run affected web/mobile and Host tests, check:web, test:host, build,
  mobile:build and check:rust if Rust changes; record actual commands, counts and
  failures in compatibility.md, along with observed CLI versions.
- [x] T009 Update the shared-session documentation and validate this feature's
  artifacts against the final implementation and recorded evidence.
- [ ] T010 Exercise Linux desktop/physical-phone continuation for each provider:
  external owner block/unlock, same native ID after mobile send, active desktop
  refresh, cancellation/input controls and older Host restart without re-pairing.
- [x] T011 Record unsupported-platform behavior and unexercised release/device
  combinations explicitly; do not claim compatibility for unrun scenarios.
