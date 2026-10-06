# Compatibility record

**Date**: 2026-10-06 | **Platform exercised**: Linux (Node v24.16.0,
rustc 1.96.0). Baseline HEAD `0837feb`, with an existing dirty workspace.

## Scope

- Affected: Host engine/server/store, new `host/native/*`, shared native core
  (`nativeReconcile.ts`, `nativeSessions.ts` types), desktop native module,
  shared Host backend, session routing/persistence, and the mobile native
  notice.
- Providers covered by the shared reader and merge: Claude Code, Codex, Pi,
  omp and OpenCode. No adapter protocol, Pi/omp shared adapter
  (`piFamily.ts`) or Rust code was changed.

## Automated checks run

| Command | Result |
| --- | --- |
| `npx vitest run -c host/vitest.config.ts host/native/sources.test.ts host/native/manager.test.ts` | 16 passed (6 source/reader, 10 lifecycle) |
| `npx vitest run -c host/vitest.config.ts host/engine.test.ts host/desktop-import.test.ts host/native-access.test.ts` | passed |
| `npm run test:host` | 368 passed, 1 failed, 5 skipped. The failure is `server.test.ts` "preserves missing and retired session handling in the assistant privacy guard": `store.isAssistantSession` caches `false` before the test rewrites the snapshot. That comes from uncommitted assistant-privacy work already in the tree and is unrelated to this feature. |
| `LANG=en_US.UTF-8 npx vitest run` (the `check:web` tests) | 5438 passed, 6 failed, 13 skipped. The failures (4 in `App.appViews.test.ts`, 1 in `NotesView.test.ts`, 1 in `SidebarProjectHoverSummary.test.ts`) persist with this feature's routing and App changes reverted, and do not involve native sessions. |
| `npx tsc --noEmit`; `npx tsc -p host/tsconfig.json --noEmit` | passed |
| `npm run build` | passed |
| `npm run host:build`, then `node build/host/monocode-host.mjs --help` | bundle built and started |

With the system language set to Chinese, the web suite renders tests in
Chinese and many assertions on English text fail. The suite was therefore run
with `LANG=en_US.UTF-8`. `LC_ALL` is not set because that locale is not
installed here, and it breaks `host/bootstrap.test.ts` through perl locale
warnings (that test passes without the override).

## Read-only real-data check

The Host lister and parser were run against this machine's provider
directories without writing anything. They listed 1,809 sources (Claude 50,
Codex 1,022, Pi 735, OpenCode 1, omp 1) in about 0.6 s with the asynchronous
scan. There were 33 warnings, all Codex rollouts over the 64 MiB limit that the
desktop reader also enforces. 47 sampled sessions (up to 15 per provider) were
read and parsed with no failures. This shows the reader and parsers handle real
formats; it is not a byte-for-byte comparison with the Rust reader (T003).

## Not verified

- Real provider CLIs: no Claude Code, Codex, Pi, omp or OpenCode turn was run
  through the new lifecycle, and no CLI versions were exercised.
- Physical phone continuation, desktop-closed continuation with real CLIs,
  handoff from an actually running older desktop, and the desktop UI in a
  running app.
- macOS and Windows: managed sessions remain read-only (`unsupportedPlatform`)
  until feature 032. A lazy session promoted on those platforms becomes
  read-only.

## Known limits

- Divergence (rewind or branch switch outside MonoCode) pauses sending with
  history kept, until 031 adds resolution.
- Settlement failures retried after the lease is released could absorb an
  external write made in that window as part of the Host turn. History stays
  in the native source.
- Large first reads (up to 64 MiB) are synchronous file reads on the Host
  thread; later reads are incremental.
- Temporary Inbox conversations are not on the Host, so their native IDs are
  not in the Host's bound index (the same as the earlier desktop discovery).

## Follow-up: compatibility removal and sync optimization (2026-10-06)

The desktop-local native path (Rust `native_sessions`/`native_access`/`native_watch`,
the `notify` dependency, the parser worker and `mirrorNative`), the
`sessions.refreshDesktopNative` RPC, the legacy desktop lock location and the
text-paired reconciliation were removed. The Host rewrites older native links
once at startup. Sync reuses resolved sources and parsed transcripts while the
revision is unchanged, skips no-op writes and keeps per-block ID arrays out of
session lists. Settings → Import reads counts and auto-sync from the Host and
"Sync now" calls `nativeSources.syncAll`.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit`; `npx tsc -p host/tsconfig.json --noEmit` | passed |
| `npm run test:host` | 366 passed, 1 failed (the pre-existing assistant privacy guard test), 5 skipped |
| `LANG=en_US.UTF-8 npx vitest run` | 5409 passed; the 6 pre-existing failures listed above remain; one mobile case updated for the removed older-Host fallback then passed |
| `cargo fmt --check`; `cargo clippy --workspace --all-targets -- -D warnings` | passed |
| `cargo test` | 522 passed, 2 failed under the Chinese system locale (`fs::tests::git_stash_*` match English git messages); both pass with `LANG=C` |
| `npm run build`; `npm run host:build` and `--help` | passed |

Not verified: real provider CLIs, a running desktop UI, phone continuation,
macOS and Windows.
