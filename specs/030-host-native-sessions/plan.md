# Implementation plan

**Date**: 2026-10-06 | **Spec**: [spec.md](spec.md) |
**Contract**: [contracts/native-manager.md](contracts/native-manager.md)

**Status**: Implemented; automated verification recorded in
[compatibility.md](compatibility.md). Manual Linux provider, phone and handoff
scenarios remain pending.

## Baseline

Git HEAD is `0837feb9966ff0bee50cc64297052a91b56e24cb`. The working tree is
dirty with unrelated Host, desktop, mobile and spec changes; this feature must
preserve them. Local toolchain: rustc 1.96.0. Provider CLI versions are recorded
in `compatibility.md` when they are actually exercised.

Current native flow (to be replaced for Host-owned projects):

- Discovery/read: `src-tauri/src/native_sessions.rs` (`sources`, `list_all`,
  `read_jsonl` incremental tail, `read_opencode`, blob stripping/compaction).
- Parse/reconcile/watch/probe: `src/features/sessions/data/nativeSessions.ts`
  (`reconcileNativeSession`, `update`, `syncNativeSessions`, 30 s timer, 5 s
  access timer, Tauri `native_watch_set`).
- Execution: desktop-local, because
  `src/features/connections/model/remoteProjects.ts` `sessionUsesHost` excludes
  `nativeSession`.
- Mirror: `sharedHost.ts` `mirrorNative` -> `sessions.refreshDesktopNative` ->
  `host/desktop-import.ts` reads the desktop database row.
- Host execution and guard: `host/engine.ts` (lease acquire at turn start, stop
  and release at settlement), `host/native-access.ts` (util-linux `flock` lease,
  `/proc` scan; non-Linux is `unsupportedPlatform`).

## Design

### Module layout

New Host modules, all without Tauri dependencies:

- `host/native/sources.ts` — source roots, account directories, environment
  overrides, listing, `sourceId`, resolution by native ID. Port of the Rust
  listing, including Codex `session_index.jsonl` titles and the 5000-file limit.
- `host/native/read.ts` — JSONL incremental read with prefix fingerprint,
  OpenCode read-only snapshot via `node:sqlite`, blob stripping and droppable
  record filtering identical to Rust.
- `host/native/manager.ts` — per-session state (`nativeStatus`, pending flag,
  retry timer), watcher set, stat fallback, refresh, import, lazy binding and
  promotion. Uses the engine's existing per-session serialization rather than a
  second lock.
- `src/integrations/harness/core/nativeReconcile.ts` — `reconcileNativeSession`
  and `withNativeTitle` moved from the desktop module so desktop tests and the
  Host share one implementation. 030 keeps its current pairing rules; 031
  replaces them.

The parser stays in `src/integrations/harness/core/nativeSessionParser.ts`. The
Host runs it in-process (no worker); large sources are already bounded at
64 MiB, and parsing happens off the provider event path.

### Engine integration

- Preparation: move the `native.acquire` call in `host/engine.ts` into a
  `manager.prepare(session)` step that also rechecks ownership and synchronizes
  before the provider bind. The existing fail-fast cached check in dispatch
  remains.
- Settlement: replace the native branch of the settlement block with
  `manager.settle(session, run)`: stop provider (already forced for native
  sessions), wait for stable revision, reconcile, persist with the latest
  queue/editing state, release lease, then the existing idle publish and
  `dispatchQueue`. Sync failure no longer prevents idle publication but blocks
  dispatch until `ready`; the manager re-invokes `dispatchQueue` on recovery.
- Host restart: natives already settle running turns as interrupted. Add a
  startup synchronization of managed sessions with queued messages, then
  dispatch per R8.
- Lazy binding: hook `session.providerBound` handling (engine event path) to
  write the `lazy` binding; record `hostRevision` after settlement; check it in
  dispatch for `send`/`compact` before using a parked process.
- Excluded owners: assistant, Inbox and orchestration bindings are included in
  the bound-source index so they are never listed as importable.

### Locking (Linux, 030 only)

Keep `acquireNativeLease`. Add a Host lock root under the Host data directory
and acquire both it and the legacy `desktopDirectory/native-session-locks` path
in a fixed order (legacy first) when a paired desktop directory exists. Both use
the existing key (`path` or `path#id`). 032 replaces the mechanism while keeping
these paths.

### Desktop and mobile

- `sessionUsesHost` stops excluding `nativeSession` when the Host advertises
  `nativeSessionManager`; older Hosts keep the current path.
- `ExternalSessions.tsx` and `NativeSessionsPanel.tsx` read `nativeSources.list`
  and call `nativeSources.import` for Host-owned projects. The desktop stops its
  native timer, watcher, probe and `mirrorNative` for those sessions; the
  auto-sync toggle writes the Host setting.
- Handoff: on upgrade, the desktop finishes any running local native turn,
  calls `refreshDesktopNative` once, then hands ownership to the Host (the Host
  marks the session managed and starts rejecting desktop refreshes).
- Mobile and desktop render `nativeStatus` (syncing/error notices with retry)
  next to the existing `nativeAccess` notices; strings go through the existing
  translation files.
- Remove desktop native discovery and Rust read commands only after no client
  path uses them; deletion is a separate cleanup task, not part of 030.

### Store

`nativeStatus` is runtime state derived by the manager and published with
session values; it is not persisted beyond `revision`/`hostRevision` in the
binding. `NativeSessionLink` additions are optional and pass through
`sanitizeNativeSessionLink` on both clients.

## Implementation notes

Decisions made during implementation (the contract reflects them):

- Lazy identity lives in `HostSession.nativeBinding`, not in
  `Session.nativeSession`. Every existing consumer treats a `nativeSession`
  link as an imported conversation (strict resume, read-only gating and
  provider stop), so a lazy link there would have changed ordinary sessions.
- `nativeStatus` is persisted in the Host snapshot and summary. It reaches
  clients through the existing sync and event paths, and survives a restart so
  that an interrupted settlement (`hostTurn`) is completed at startup.
- History merges use parser block IDs (`nativeIds`) with a Host-turn absorb
  rule, instead of moving the text-paired reconciliation unchanged into the
  Host. Wrapped prompts (skills or orchestration) would otherwise defer
  synchronization after every Host turn. The text-paired rule remains only for
  the first takeover of a link from an older desktop that has unreconciled
  blocks.
- Not-ready sessions queue sends instead of rejecting them, so a short
  `syncing` state never loses a message.
- Listing scans asynchronously and reads headers in 64 KiB chunks. A
  synchronous scan of 1,809 real sources took 1.7 s of blocking I/O on the Host.
- The 5-second poll finds managed sessions with a SQLite `json_extract` over
  the summary index, without parsing transcripts.
- Parity with the Rust reader is covered by TypeScript fixtures that mirror the
  Rust cases, and by a read-only scan of this machine's real sources. Rust
  output was not recorded side by side (T003 remains open).

## Risks

- **Reader parity.** A divergent TS port could change history. Mitigate with
  shared fixtures read by both Rust and TS readers and asserting equal output
  before the desktop switches to the Host list.
- **Stable-revision wait.** Providers may flush after exit. The bounded wait and
  watcher resync cover late writes; tests inject delayed writes.
- **Lazy promotion latency.** One `stat` (or one SQLite query for OpenCode) per
  send; negligible compared with provider startup.
- **Watch limits.** Only watched sessions are watched, never whole provider
  roots; listing stays on demand.
- **Environment differences.** The standalone Host service may not inherit the
  desktop's `CODEX_HOME`/`CLAUDE_CONFIG_DIR`. Listing warnings name the roots
  used; the desktop passes its overrides when it starts the local Host.

## Constitution check

- Bounded change: Host native lifecycle only; history mapping and cross-platform
  guard are separate features 031/032. Unrelated dirty work is preserved.
- Shared contracts: all new fields are optional; old histories and older clients
  remain readable; `nativeAccess` meanings are unchanged.
- Provider isolation: strict resume stays in adapters; source formats are only
  read, never written. Pi/omp shared paths require regressions for both.
- Evidence: real-provider, desktop-closed and handoff scenarios stay unverified
  until exercised and recorded with CLI versions.
- Validation: failure regressions for preparation, settlement, sync failure,
  watcher loss, queue recovery and handoff; run `check:web`, `test:host`,
  `build`; `check:rust` only if Rust changes.
- Disclosure UI: any new notice expansion uses `AnimatedCollapse`.

## Verification

Targeted tests first: reader parity fixtures, manager unit tests (status
transitions, pending flag, backoff, lazy promotion), engine lifecycle tests
(two turns, queue, cancel, failure, compact, persistence failure), server RPC
tests, desktop routing/import tests and mobile status rendering. Then
`npm run check:web`, `npm run test:host`, `npm run build`. Linux real-provider
continuation per provider and desktop-closed continuation are manual and
recorded separately; macOS/Windows stay unverified until 032.
