# Plan

## Backend (Rust, `src-tauri/src`)

- `native_sessions.rs`: provider source table (`sources()`), one entry per
  provider root and MonoCode account profile:
  - claude: `$CLAUDE_CONFIG_DIR|~/.claude/projects/*/<id>.jsonl` plus
    `<app data>/provider-accounts/claude/<account>/projects`; depth 1 so
    `<id>/subagents/agent-*.jsonl` is skipped; identity is the file name; the
    first non-sidechain `user`/`assistant` row supplies `cwd` and a label.
  - codex: `$CODEX_HOME|~/.codex/sessions` plus account profiles.
  - pi: unchanged roots.
  - omp: `~/.omp/agent/sessions` (omp 18.6 has no env override); a padded
    `title` record precedes the Pi v3 header.
  - opencode: `$XDG_DATA_HOME|~/.local/share/opencode/opencode.db`, opened
    read-only; revision `sqlite:<max time_updated>:<messages>:<parts>`.
- `native_session_read` returns `{revision, text, offset, head, appended}`;
  see contracts/native-watch.md.
- `native_access.rs`: per-provider argv and session-flag detection, a
  `holder {pid, command, provider}` on blocked probes, and lock keys of
  `path#id` for the shared opencode database. File-descriptor matching is
  skipped for SQLite (every opencode process holds the database open).
- `native_watch.rs` (new dependency `notify` 8, no default features): watches
  parent directories of imported sources (and `opencode.db-wal`) plus shallow
  discovery directories; debounces 200 ms; emits `native-session-changed` and
  `native-sessions-discovered`.
- `session_store.rs`: `session_find_native_id` accepts all five providers and an
  account; `session_list_provider_bindings` lists bound provider ids.

## Frontend

- Parsers: `claudeSessionImport.ts`, `opencodeSessionImport.ts`, omp flavor in
  `piSessionImport.ts` (Pi behavior unchanged).
- Adapters resume strictly: Claude (`--resume`, account/cwd fixed, init id must
  match), omp (`--resume <path>` + id check shared with Pi), OpenCode (adopt the
  session; no fork/create fallback).
- `features/sessions/data/nativeSessions.ts`: bounded text cache for
  incremental reads, coalesced watcher refreshes, observe-only updates while
  another writer owns the session, quiet discovery and bindings for the sidebar.
- UI: `app/shell/ExternalSessions.tsx` (sidebar group, `AnimatedCollapse`),
  Settings panel lists all providers; composer hint names the holder.
