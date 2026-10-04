# Implementation plan

Base: local `main` at `6b42c95`; existing unrelated working-copy edits were not
copied. Worktree: `codex-pi-session-sync`.

The constitution and the completed Pi upgrade's spec, plan, contract and tasks
were read before implementation. This feature has its own artifacts and active
feature pointer; the prior compatibility record remains intact.

A small Rust module discovers provider-owned files and reads bounded stable
snapshots off the UI thread. It follows existing home/env resolution, rejects
symlink escapes on reads, and returns per-file warnings without hiding good files.
Provider-specific pure TypeScript parsers live under the Codex and Pi provider
directories. Their shared input/output contracts live under harness/core.

The existing SQLite session table gains an optional `native_session_json` column
through its existing self-repairing column migration. Existing rows have null
metadata. The session store reads/writes sanitized optional links and preserves
native timestamps for source-only snapshots.

The session data service serializes manual import and background refresh, acquires
the app's existing session operation guard, checks live state, stops stale idle
processes, persists before publishing, and rebinds the original provider ID.
The app invalidates restored-session caches and updates history/open tabs. The
settings panel reuses provider settings navigation, search and localization.

Codex marks imported resume bindings as strict. Pi resumes the exact source path
and verifies the returned native ID. Both reopen idle imported processes before
later operations to read changes made by the external CLI. OMP keeps existing
ID-based resume/fallback behavior.

Validation: parser, service, settings UI, persistence, native resume and Pi/OMP
regressions; actual isolated CLI resume/read smoke; check:web, test:host, build,
and check:rust. Real paid-model sessions and native desktop GUI are recorded
separately from automated and protocol evidence.

## External native ownership follow-up

The native access layer observes same-user Linux /proc argv, cwd and native
transcript file descriptors. It recognizes ordinary Codex/Pi CLI names and Pi
package launchers. Exact session arguments/file ownership block takeover;
ambiguous provider processes in the source cwd remain read-only. MonoCode's own
managed subprocess trees are excluded so ordinary live turns and warm children
remain usable. Renamed/opaque third-party launchers are not verified.

An application-owned, source-path-derived flock lease serializes native mutations
across MonoCode instances sharing the same app-data directory. It lives for the
provider operation and releases on completion/failure; a native CLI does not
cooperate with this lease. The UI probe is advisory, and send/compact/rewind repeat
access checks before touching the provider. Steering rechecks ownership inside
the already active lease. The app also blocks programmatic submissions before
clearing the composer when its cached access is unavailable.

Access polling runs every five seconds independently of optional 30-second history
sync. A held/ambiguous external conversation continues refreshing its saved
history. A release transition persists the latest snapshot before enabling input.
Probes are coalesced, unknown/errors fail closed, and access status stays in runtime
state rather than persisted history. The localized banner explains read-only access;
existing drafts and the ability to stop a MonoCode-owned turn are preserved.

An external CLI left open remains read-only even after its visible answer finishes.
Pi's append-only history does not prove agent_settled, so owner exit is the reliable
takeover boundary. Other platforms report unknown ownership. An uncooperative
CLI launched after the final pre-write check can still race: full cross-CLI
exclusion requires native cooperation. A renderer lost mid-operation can retain
its in-process lease until the app exits; this deliberately blocks takeover.
