# Verification record

Implemented for ordinary project conversations. Native desktop layout and
unrelated SQLite data remain local; Host snapshots are the canonical history.
Existing remote Host command restrictions remain explicit in
docs/shared-sessions.md. `/operator`, orchestration, handoff and BTW execution have not been ported to the Host protocol.

Environment: Linux x64, Node 24.16.0, Cargo 1.96.0. Packaged Host runtime:
Node 24.21.0. Installed Pi reports 1.0.2; OMP is not installed. No paid provider
turn was run for this change.

| Check | Actual result |
| --- | --- |
| Web regressions and TypeScript (`npm run check:web`) | PASS: 410 files / 4314 tests; 2 files / 13 tests skipped |
| Host regressions (`npm run test:host`) | PASS: 24 files / 127 tests; 1 file / 5 tests skipped |
| Desktop frontend (`npm run build`) | PASS; existing CSS/chunk-size warnings remain |
| Desktop executable (`cargo build --bin monocode`) | PASS; current running process was not restarted |
| Rust format, clippy and tests (`npm run check:rust`) | PASS on final full rerun: 509 tests; 1 ignored |
| Mobile frontend (`npm run mobile:build`) | PASS |
| Desktop Host packaging (`npm run host:desktop-package`) | PASS: Linux x64 standalone runtime/bundle smoke, Node 24.21.0 |
| Real current SQLite migration | PASS on isolated SQLite backup copies: 11 combined conversations, 3 projects; original databases untouched |

Regressions exercise automatic detached startup and owner/credential reuse;
idle legacy Host upgrade without changing phone credentials; rejection of a
busy upgrade; migration retry, deletion tombstones and image reads; retained
provider account binding and scoped account process environment; native-path
desktop pane routing; and desktop creation/phone continuation/desktop refresh
against a real loopback Host with a fake provider. Concurrent sends are serialized through the same durable Host queue. Original desktop source bytes remain unchanged.
Native import refreshes retain their source link, reuse copied attachments and
remain protected by desktop native ownership checks; Host refuses to launch a
second provider for those imports. Deleted canonical bindings are removed before
workspace restore. Native worktree deletion honors shared conversation references
and holds a write reservation while Git operates.

One full parallel Rust run failed the newly merged native advisory-lease test
at its immediate post-drop lock assertion. Its isolated rerun and the final
complete format/clippy/test run passed. No production native-lease behavior was
changed to hide that transient failure.

Unverified: native desktop GUI restart and on-device phone interaction; real
authenticated provider continuation; macOS/iOS/Windows builds; cross-architecture
desktop installers. The current running desktop has not been restarted and
continues using its existing native executable until it is restarted/rebuilt.

To apply in development, restart `npm run tauri:stable`. Desktop builds the Host
before startup; no manual desktop URL/token entry is required. A phone still
needs its reachable Host URL and device token. For a first legacy Host upgrade,
finish any running Host turn before retrying startup.

## Main-tree integration verification

The shared-session changes were isolated from unrelated uncommitted UI/mobile
work and validated against main `01a7b35` in a temporary Git worktree.

- `npm run check:web`: PASS, 414 files / 4338 tests; 2 files / 13 tests skipped.
- `npm run test:host`: PASS, 25 files / 159 tests; 1 file / 5 tests skipped.
- `npm run build` and `npm run mobile:build`: PASS.
- `npm run host:desktop-package`: PASS, Linux x64 Node 24.21.0 bundle smoke.
- `RUST_TEST_THREADS=1 npm run check:rust`: PASS, format/clippy and 509 tests; 1 ignored.
  The preceding parallel run reproduced the already recorded immediate
  post-drop advisory-lock assertion failure; no native-lease production code
  was changed for this integration.

Main already contains durable shared message queues: concurrent sends queue on
the same Host, including desktop/mobile queue controls. The integration retains
main's committed image and scrollbar fixes. No remote push, desktop restart or
phone installation is part of this local main-tree integration.
