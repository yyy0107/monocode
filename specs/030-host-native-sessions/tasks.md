# Tasks

Tasks remain unchecked until the implementation and its stated validation have
actually completed. Automated checks do not complete manual provider, phone or
desktop-handoff scenarios.

## Phase 1: Contract and shared core

- [x] T001 Add optional `NativeSessionLink` fields (`mode`, `dataDir`,
  `nativeIds`), `HostSession.nativeStatus`/`nativeBinding` and
  `Session.nativeSyncStatus`; extend `sanitizeNativeSessionLink` and protocol
  types. Older links without `mode` still load and are taken over by the Host.
- [x] T002 Move `reconcileNativeSession`/`withNativeTitle` into
  `src/integrations/harness/core/nativeReconcile.ts` unchanged, and add
  `mergeNativeHistory`; desktop tests pass against the moved module.

## Phase 2: Host sources and reads

- [ ] T003 Record current Rust reader output for shared fixtures and compare it
  byte-for-byte with the Host reader. *Not done:* TypeScript fixtures mirror the
  Rust cases, and a read-only scan of real local sources parsed without
  failures, but Rust output was not captured side by side.
- [x] T004 Implement `host/native/sources.ts` and `host/native/read.ts` (all five
  providers, profiles, account directories, limits, incremental JSONL,
  OpenCode snapshot, record compaction, chunked asynchronous header scan).
- [x] T005 Add `sourceId`, the bound-source index (any Host conversation using
  the provider ID) and `nativeSources.list`/`import` RPC, with tests for stale,
  unknown and already-bound sources.

## Phase 3: Host lifecycle

- [x] T006 Implement `host/native/manager.ts` status machine, pending flag,
  backoff retry and `sessions.refreshNative`.
- [x] T007 Integrate preparation (leases, ownership recheck, pre-send merge,
  strict bind) into `host/engine.ts`; regressions for a missing source refusing
  before provider invocation and for external records landing before the prompt.
- [x] T008 Shared settlement for success, failure, cancel and compact with a
  stable-revision wait, queue preservation and dispatch after recovery;
  regressions for a delayed final write, a failed read with automatic retry and
  queue dispatch.
- [x] T009 Watcher plus 5-second stat fallback, busy pending flag and the
  Host-owned auto-sync setting; regressions for the stat fallback and for
  auto-sync off while preparation/settlement still synchronize.
- [x] T010 Host lock root plus legacy desktop lock; regressions that both lock
  locations are held during a Host turn and released afterwards.
- [x] T011 Lazy binding at settlement, `hostRevision`, and promotion on an
  external change; regression covering parked reuse without change and takeover
  with change.
- [x] T012 Startup completion of interrupted settlement (`hostTurn`) and
  rejection of `refreshDesktopNative` for managed sessions; regressions for both.

## Phase 4: Clients

- [x] T013 Route native sessions in Host projects through the Host
  (`sessionUsesHost`, `shouldPersistSession`); the desktop no longer mirrors them.
- [x] T014 Desktop native list/import uses Host RPC; local timers, watcher,
  probe and update skip Host-owned conversations; the auto-sync toggle updates
  the Host setting; Host-owned ownership probes come from `sessions.nativeAccess`.
- [x] T015 Desktop handoff of older desktop imports through
  `sessions.refreshNative` (once per run) and Host rejection of older desktop
  mirrors after takeover.
- [x] T016 Blocking `nativeStatus` notices on desktop and mobile with localized
  text. Offline-Host draft/queue behavior is the existing shared-session
  behavior and was not changed.

## Phase 5: Verification and records

- [x] T017 Run targeted tests, `npm run test:host`, `npm run check:web` scope
  (`vitest run`, `tsc --noEmit`), `npm run build` and `npm run host:build`;
  record results in `compatibility.md`. Rust code was not changed.
- [ ] T018 Linux manual scenarios per provider: import, two turns from desktop
  and phone, queue/cancel/failure/compact, desktop closed with external CLI
  appends, lazy promotion, handoff from an older desktop. Record CLI versions.
- [x] T019 Update `docs/shared-sessions.md` and the `AGENTS.md` pointer; align
  this record with the implementation.
