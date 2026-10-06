# Feature 021: Multi-agent native session sync

## Context

Feature 002 imported Codex and Pi sessions and kept them in sync by polling.
Users also start sessions in Claude Code, omp and OpenCode, and want to watch
those sessions live in MonoCode and continue them without two writers
corrupting one conversation.

## User decisions (fixed scope)

- Providers: Claude Code, omp and OpenCode are added; Codex and Pi gain account
  matching and the same live path.
- Updates: file watching plus incremental reads; polling stays as the fallback.
- Ownership: strictly read-only while any external CLI may hold the session;
  show which process holds it; unlock automatically after that process exits.
- Discovery: un-imported external sessions are listed automatically under their
  project in the sidebar.

## Requirements

- R1 Discovery lists sessions from every provider source with provider, id,
  cwd, revision, storage kind (`jsonl`/`sqlite`) and owning account profile.
  Persisted `native_session_json` from feature 002 stays readable.
- R2 Each provider transcript is parsed by an independently tested pure parser.
- R3 Continuing an imported session resumes exactly that native conversation.
  A failed or mismatched resume is an error, never a silent new session.
- R4 Imported sessions update within about a second of a CLI write while the
  CLI owns them; a lost watcher degrades to the existing 5 s probe.
- R5 Any external process that may own the session keeps the composer read-only;
  the hint names the provider and pid when known.
- R6 The sidebar shows, per local project, external sessions not yet bound to
  MonoCode history (newest 5, show more), with animated disclosure.
- R7 Application-owned labels are localized (en, zh-CN).

## Out of scope

- Process ownership detection on macOS/Windows (stays `unsupportedPlatform`,
  read-only).
- Writing to native history outside the provider CLIs themselves.
- Headless Host continuation of imported sessions (Host keeps refusing them).
