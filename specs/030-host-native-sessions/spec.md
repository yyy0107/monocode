# Feature 030: Host-owned native session lifecycle

**Date**: 2026-10-06

**Status**: Implemented; automated checks pass on Linux. Real-provider, physical
phone, desktop handoff and non-Linux scenarios remain unverified; see
[compatibility.md](compatibility.md).

## Context

Ordinary conversations in local desktop projects already execute on the shared
Host (`docs/shared-sessions.md`). Imported native Claude Code, Codex, Pi, omp
and OpenCode conversations still do not: `sessionUsesHost` excludes any session
with `nativeSession`, so the desktop discovers, parses, watches, probes and runs
them locally, persists them in its own `monocode.db`, and mirrors snapshots to
the Host through `sessions.refreshDesktopNative`. Feature 025 lets the phone
continue such a conversation on a Linux Host, but history written by an
external CLI only reaches the Host while a desktop synchronization client runs.

The user's goal is one native session lifecycle owned by the Host for new,
imported and existing conversations on Linux, macOS and Windows, with automatic
synchronization, recovery and queue dispatch after each turn, independent of the
desktop. That goal is delivered in three features:

| Feature | Scope |
| --- | --- |
| **030 (this record)** | Host native session manager, execution routing, turn preparation/settlement, watcher and queue, desktop handoff. Uses the existing Linux guard. |
| 031 (planned) | Run-fragment mapping by native record identity, legacy-history snapshots, branch/rewind conflicts, `sessions.resolveNativeConflict` and history snapshot reads. Replaces text-based user-turn pairing. |
| 032 (planned) | Rust `native-guard` helper (`File::try_lock`, `sysinfo`, macOS file holders, Windows Restart Manager), cross-platform ownership, lock-key unification and packaging in the standalone Host and three desktop bundles. |

030 defines the full shared contract so 031 and 032 add behavior without
changing field meanings. Fields and methods owned by later features are
reserved, optional and absent from 030 responses.

## Decisions recorded during planning

- D1 New ordinary Host sessions **bind native identity lazily**. When a provider
  reports its conversation ID, the Host records provider, native ID, account data
  directory, cwd and storage, and records the source revision after each Host
  turn. Such a session keeps warm process reuse (parking) and skips the
  per-turn lock and sync. Before a send, the Host compares the source revision
  with its recorded value; an external change (or an explicit link) promotes it
  to a managed native session. (User decision, 2026-10-06.)
- D2 Source discovery and reads are ported from `src-tauri/src/native_sessions.rs`
  to the Host in TypeScript, reusing the shared parser in
  `src/integrations/harness/core/nativeSessionParser.ts` and `node:sqlite`
  already used by `host/store.ts`. The Rust helper in 032 stays limited to
  locking and ownership probes.
- D3 Native ownership, the advisory lock and process checks stay on the existing
  Linux implementation in 030. macOS/Windows remain conservatively read-only for
  managed sessions until 032.

## Requirements

- R1 **Execution routing.** Every conversation in a shared-Host local project,
  including imported native conversations, executes on the Host. The
  `nativeSession` field no longer determines execution routing, persistence or
  queue ownership on any client. Assistant, temporary Inbox and orchestration
  sessions keep their existing lifecycles.
- R2 **Native session manager.** The Host owns source resolution, discovery,
  reading, parsing, watching, per-session write serialization and history
  reconciliation for all five providers, using the same source roots, account
  profile directories and environment overrides as the desktop today
  (`CLAUDE_CONFIG_DIR`, `CODEX_HOME` and sibling `~/.codex-*` profiles,
  `PI_CODING_AGENT_DIR`, `~/.omp/agent/sessions`, `XDG_DATA_HOME` for OpenCode,
  and MonoCode provider-account directories). Reading semantics, size limits,
  blob stripping and incremental JSONL tail reads match the current Rust reader.
- R3 **Identity.** A native binding records provider, native ID, account ID,
  resolved account/data directory, cwd, source path and storage. A new
  conversation may be bound before its source file exists; the path is filled
  when the source appears. An existing or imported conversation must resolve to
  exactly one source. A missing, ambiguous or mismatched source sets an error
  state and never creates or forks a provider conversation.
- R4 **Status.** `sessions.nativeAccess` keeps its ownership meaning. A new
  optional `nativeStatus` reports synchronization: `ready`, `syncing`, `error`
  in 030; `conflict` is reserved for 031. Old clients ignore it. While a
  managed session is not `ready`, ordinary sends wait in the Host queue.
- R5 **Turn preparation.** Within the session's serialized Host operation, a send
  or compaction on a managed native session acquires the writer lease, re-checks
  external ownership under it, and brings history up to the current source
  revision before resuming the same native conversation. Any failure releases the
  lease and refuses the turn before invoking the provider.
- R6 **Turn settlement.** Success, failure, cancellation and compaction share one
  settlement: wait for running controls, stop the turn's provider process, read a
  stable source revision, reconcile and persist it, release the lease, publish
  idle, then allow the next turn. Streamed output is never discarded because
  synchronization failed; the session enters `error` with bounded automatic
  retries, and sends wait until it is `ready`.
- R7 **Watching.** The Host watches the sources of managed sessions without a
  desktop. File events that arrive while a session is busy are kept as a
  pending flag and processed during settlement. A 5-second stat check covers lost
  watch events for watched sessions. A revision change or pending flag triggers
  a read. Turn preparation and settlement always synchronize, regardless of the
  background auto-sync setting, which moves to the Host.
- R8 **Queue.** Queued messages never block synchronization. A sync commit keeps
  the latest queue and queued-message editing state. When a session becomes
  writable again after an error or external owner, the Host retries queue
  dispatch automatically. Cancel, approval, answer and steering stay available
  during a running turn.
- R9 **Lazy binding (D1).** New ordinary sessions record identity on
  `session.providerBound` and the post-turn source revision. Before each send the
  Host checks the revision; on an external change it stops any parked process,
  promotes the session to managed, synchronizes, and continues under R5/R6. The
  native-source list never offers a conversation already bound to any Host
  session, including assistant, Inbox and orchestration sessions.
- R10 **RPC.** Add `nativeSources.list`, `nativeSources.import` and
  `sessions.refreshNative`. Sources are resolved by the target Host and
  addressed by Host-issued opaque source IDs, never client-supplied paths.
- R11 **Clients.** The desktop lists and imports native sources through the Host
  and stops local native discovery, watching, probing, execution and mirroring
  for Host-owned projects. Desktop and mobile render Host `nativeStatus` and
  history. While the Host is offline, history and drafts stay viewable and sends
  wait for reconnection. Application text follows `docs/localization.md`.
- R12 **Handoff.** Existing imported sessions keep their session ID, account
  binding and native ID. A native turn running on an older desktop finishes and
  publishes its final mirror before the Host takes ownership. After takeover the
  Host rejects `sessions.refreshDesktopNative` for that session with a specific
  error, so an older desktop cannot overwrite Host history.
- R13 **Lock compatibility.** The Host lease moves to the Host data directory.
  While a paired desktop directory is known, the Host also holds the legacy lock
  in that directory, so older desktops and Hosts remain mutually exclusive.

## Acceptance scenarios

1. On Linux, import one conversation per provider through the Host list. Run two
   consecutive turns from desktop and phone. Both resume the same native ID and
   the turns appear in both clients and the provider CLI.
2. Close the desktop. Append turns with the external CLI. The phone shows the new
   history after the CLI exits and can continue the conversation.
3. Queue two messages during a native turn; cancel one turn; fail one turn;
   compact once. Settlement, history and queue dispatch complete each time.
4. Disable background auto-sync, drop watch events, delay the provider's final
   write, and inject a persistence failure. Each case recovers automatically
   without losing streamed output or queued messages.
5. Start a new ordinary conversation, finish a turn, continue it with the
   external CLI, then send from MonoCode. The Host detects the change, promotes
   the session and resumes after synchronizing. Without an external change the
   parked process is reused.
6. Upgrade while an older desktop runs a native turn. That turn finishes on the
   desktop, its history reaches the Host, and later turns run on the Host. An
   older desktop's refresh is rejected after takeover.
7. Ambiguous source, missing source for an existing session, and an unsupported
   platform keep history readable, report an error/read-only reason, and never
   create a new provider conversation.

## Out of scope

- Mapping runs to native record IDs, legacy snapshots, branch/rewind conflict
  handling and conflict resolution (031).
- macOS/Windows ownership checks, the Rust helper, unified lock keys and
  packaging (032).
- Mobile native-source import UI, transferring native files between computers,
  and new provider protocols or transcript formats.
- Publishing, pushing, merging, installing builds, or restarting the user's
  running desktop/Host without a separately scoped request.
