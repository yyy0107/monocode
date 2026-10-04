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
