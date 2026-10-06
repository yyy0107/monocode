# Contract: Mobile native continuation

## Capability

The authenticated public Host descriptor advertises `sessions.nativeAccess`
when the Host can serve native ownership probes and guard native continuation.
The desktop-only lifecycle status includes `nativeSessionAccess: 1` alongside
its existing shared-desktop and orchestration capabilities. Missing or older
values require an idle Host upgrade; they never imply that an imported session
is writable.

## Ownership RPC

`sessions.nativeAccess({sessionId})` returns `NativeSessionAccess` for an
imported conversation and `null` for an ordinary conversation. Existing shared
access fields are retained:

| Field | Meaning |
| --- | --- |
| `state` | Shared type: `idle`, `external`, `unknown`, or `checking`; the Host probe returns a settled result |
| `reason` | String; known Host reasons include `available`, `externalProcess`, `ambiguousProcess`, `anotherMonocode`, `unsupportedPlatform` and `unavailable` |
| `checkedAt` | Probe time in Unix milliseconds |
| `path` | Native source path bound to this conversation |
| `holder` | Optional provider, pid and command of the potential owner |

Clients distinguish a pending request, unavailable method and a failed request
from a supported probe result. Mobile probes the RPC regardless of descriptor
capabilities so earlier supported Hosts without the capability string still
work. Only HTTP 400 with the exact error `Unsupported host method` maps to an
older Host; it leaves native history readable and execution disabled. Other
request errors retain their separate retryable failure state. A mobile response
must still match the selected session and Host connection when applied.

`idle` is advisory. Every Host native send or compaction reacquires the shared
advisory lock and performs a fresh external-process check immediately before
provider invocation. Any non-idle check releases the attempted lease and refuses
execution. A client does not supply or override ownership authority.

A probe that takes a temporary advisory lease waits until the lease holder has
exited before returning `idle`. Its own pending lock release must not make the
next immediate send fail as though another MonoCode writer held the session.
Turn cleanup likewise awaits release after stopping the native provider and
before publishing the settled idle snapshot.

## Identity and lock

An imported `Session.nativeSession` retains provider, native provider session ID,
path, revision, optional storage/account metadata and imported block IDs. It
matches `Session.providerSessionId`, harness, cwd and applicable account binding.
Adapters must resume the same native ID or produce an error; no create/fork
fallback is allowed.

The advisory lock key is the native path for JSONL and
`path#providerSessionId` for OpenCode's shared SQLite database. Host and desktop
use the same hashed lock file in the paired desktop data directory. The Host
holds the lease until its provider process has stopped. Missing desktop pairing,
missing lock support, uncertain ownership and unsupported platforms fail closed.

## UI and synchronization

An idle imported conversation enables the composer only after a successful
current idle probe. A running Host-owned turn preserves existing cancellation,
approval and question controls. A running desktop-native mirror does not grant
the phone permission to start another writer.

Read-only notices distinguish checking, older Host, transient access failure,
external holder, ambiguous holder, another MonoCode owner and unsupported
platform. Application text is translated; provider values and user content are
preserved.

`sessions.refreshDesktopNative` must not overwrite a running Host turn with a
stale desktop-native snapshot. Its status, run ID, current transcript and native
identity remain intact until settlement. Idle refresh continues using the
existing reconciliation and attachment reuse rules. This feature adds no new
mobile/native-file storage format or autonomous external transcript watcher.
