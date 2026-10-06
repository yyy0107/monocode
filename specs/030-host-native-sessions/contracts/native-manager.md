# Contract: Host native session manager

All additions are optional. Clients and Hosts without them keep their current
behavior. Items marked *(031)* are reserved and not produced by feature 030.

## Native binding

`Session.nativeSession` (`NativeSessionLink`) keeps its existing fields
(`provider`, `providerSessionId`, `storage`, `accountId`, `createdAt`,
`updatedAt`, `path`, `revision`, `blockIds`). New optional fields:

| Field | Meaning |
| --- | --- |
| `mode` | `"managed"` once the Host owns the conversation's lifecycle. Absent on links an older desktop imported; the Host takes those over on its first sync, refresh or send. |
| `dataDir` | Resolved provider account/data directory that owns the source. |
| `nativeIds` | Native parser block IDs already represented in history. Absent on older links, where `blockIds` held native IDs. |

`blockIds` lists every history block the Host has reconciled, including the
Host's own turn blocks. The binding must agree with `Session.harness`,
`providerSessionId` and the applicable account. A mismatch is an error state,
never a rebind.

### Lazy identity (D1)

A MonoCode-started Host conversation carries `HostSession.nativeBinding`
(`provider`, `providerSessionId`, `accountId?`, `dataDir?`, `path?`, `storage?`,
`hostRevision?`), never a `nativeSession` link. It records which native
conversation the provider created and the source revision after the last Host
turn. It takes no lease, is not watched, and keeps warm process reuse.

## Sync status

`HostSession.nativeStatus?` is persisted in the Host snapshot and summary. It is
mirrored to desktop sessions as `Session.nativeSyncStatus`.

| Field | Meaning |
| --- | --- |
| `state` | `ready`, `syncing`, `error`; `conflict` *(031)* |
| `reason` | `sourceMissing`, `sourceAmbiguous`, `readFailed`, `parseFailed`, `persistFailed`, `bindingMismatch`, `diverged`, `deferred` |
| `message` | Diagnostic; provider and system text is preserved |
| `revision` | Last source revision applied to history |
| `pendingChange` | Source changed while a turn ran; settlement reads it |
| `hostTurn` | A Host turn wrote records that settlement has not absorbed yet |
| `retryAt` | Next automatic retry (ms) in `error` |
| `checkedAt` | Last status change (ms) |

`sessions.nativeAccess` keeps its 025 shape and reasons. While a managed
session is not `ready`, ordinary sends are queued; queue dispatch, drafts, plans
and compaction wait until it is `ready`. `diverged`, `sourceMissing`,
`sourceAmbiguous` and `bindingMismatch` make clients read-only with a localized
notice. Transient states (`syncing`, `readFailed`, `parseFailed`,
`persistFailed`) keep the composer usable, and their messages wait in the queue.

## Source IDs

`sourceId` = the first 32 hex characters of
`sha256(provider | storage | dataDir | nativeSourceKey)`. Clients never send
paths. The Host maps a `sourceId` to its current listing and rejects unknown or
stale IDs.

## RPC

### `nativeSources.list({ refresh?: boolean, autoSync?: boolean })`

Returns `{ sources: NativeSourceSummary[], warnings, scannedAt, autoSync, managedCount, lastSyncedAt? }`.
`NativeSourceSummary` is `NativeSessionFile` plus `sourceId` and
`boundSessionId?`. Any Host conversation that already uses the provider ID
(ordinary, lazy, assistant or orchestration) is reported as bound and cannot
be imported again. The asynchronous scan is cached for 10 s, and concurrent
requests share it. Limits match the desktop reader: 5000 files and 64 MiB.
`autoSync` stores the Host's background auto-sync setting.

### `nativeSources.import({ sourceId })`

Opens the source's project on the Host and creates, or returns the existing,
session bound in `managed` mode with history read from the source. Fails for
unknown or stale IDs and for sources without a user message.

### `sessions.refreshNative({ sessionId })`

Synchronizes immediately, regardless of the auto-sync setting. Returns
`nativeStatus`. A running session records `pendingChange` and is read during
settlement.

### `nativeSources.syncAll()`

Refreshes every managed conversation, one at a time, and returns
`{ synced: number }` (Settings → Import "Sync now").

### Removed: `sessions.refreshDesktopNative`

Older desktops mirrored their native history through this method. It was
removed with the desktop-local native path; the Host answers it as an
unsupported method. Native links saved by older clients are rewritten once at
Host startup (`mode: "managed"`, `nativeIds` from `blockIds`, `storage`
defaulting to `jsonl`) and re-read from their source.

### Reserved *(031)*

`sessions.resolveNativeConflict` and history snapshot reads.

### Capability

The public descriptor advertises `sessions.refreshNative`,
`nativeSources.list`, `nativeSources.import` and `nativeSources.syncAll`. The desktop lifecycle status
reports `nativeSessionManager: 1`; desktop bootstrap treats a Host without it as
older and upgrades it when idle.

## Merge rules (030)

Native blocks are identified by parser block IDs. Claude, Pi, omp and OpenCode
use record IDs; Codex uses the record's line index, which is stable in an
append-only file. Prompt text is never used for matching on managed links.

- **Host turn** (`hostTurn`): native records added since the last applied
  revision were written under the Host's lease. They are absorbed: Host turn
  blocks stay, and the native IDs are recorded. A tracked native block that
  disappears during a Host turn is dropped from tracking.
- **External change**: new native blocks are appended after the history, and
  before the blocks of a turn that is being prepared.
- **Divergence**: a tracked native block that disappears outside a Host turn
  sets `error/diverged`. History is untouched and sending pauses (031 resolves
  it).

## Turn lifecycle (managed sessions)

```
prepare (per-session serial):
  acquire the lease in the Host data dir -> recheck owner
  -> read source; merge external records before this turn's prompt
  -> status ready + hostTurn -> strict provider bind -> provider writes
settle (success, failure, cancel and compaction; after provider stop):
  wait for a stable revision (two equal stats 250 ms apart, at most 10 s)
  -> read + merge (absorb), keeping the latest queue and editing state
  -> release leases -> idle publish -> dispatch queue if ready
```

On a sync failure, the turn's streamed blocks are kept. The status becomes
`error` with retries after 1 s, 5 s, 30 s, then every 5 min. A successful retry
sets `ready` and dispatches the queue.

## Watching

A managed session is watched while it is running, has queued messages, is not
`ready` or has a pending change, or was opened by a client (`sessions.sync`,
`sessions.refreshNative`) within the last 30 minutes. The Host uses `fs.watch`
on the source path, plus a 5-second stat (or SQLite revision) check for lost
events. With background auto-sync off, only idle watcher- and poll-driven reads
stop. Preparation, settlement, retries, pending changes and
`sessions.refreshNative` still synchronize.

## Lazy promotion

At settlement of a non-native Host session whose provider reported an ID, the
Host records `nativeBinding`: it resolves the source by provider ID (a unique
file-name match) and stores `hostRevision`. Before the next send, it compares
the source revision. If the revision changed, it parses the source as it was at
`hostRevision` (the JSONL prefix up to its size, or OpenCode messages created
by then). Blocks absent from that earlier state are external. If there are
none, only `hostRevision` advances. Otherwise the Host stops the warm process,
creates a managed link whose `nativeIds` are the Host-written records, and runs
managed preparation, which appends the external records before the new
prompt. Assistant, orchestration and Inbox sessions are never promoted.
