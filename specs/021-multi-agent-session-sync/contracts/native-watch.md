# Contract: watching and incremental reads

## `native_watch_set({paths, discover})` -> `{active, error?}`

Replaces the watched set. Paths outside configured sources are ignored.
Parent directories are watched non-recursively (atomic replacement would orphan
a file watch); SQLite sources also match `<db>-wal`. With `discover`, provider
roots plus their project directories (Codex: newest year/month/day chain) are
watched, capped at 256 directories. `active: false` means the frontend relies on
polling (5 s access probe, 30 s optional history sync).

Events (debounced 200 ms): `native-session-changed {path}`;
`native-sessions-discovered` when a `.jsonl` or directory appears in a
discovery directory, or an unimported source changes there. Automatic discovery
scans run at most once per 10 seconds. Events suppressed during that interval or
an ongoing scan request one trailing scan, so the final new source is still
listed when writes stop. Explicit refresh can bypass the interval; disposing the
sync runtime cancels the trailing timer.

## `native_session_read({path, providerSessionId?, fromOffset?, head?})`

Returns `{revision, text, offset, head, appended}`. JSONL: only complete lines
are returned; `offset` is their end and `head` is the SHA-256 of the first
`min(4096, offset)` bytes. When `fromOffset/head` match and the file did not
shrink, only the appended lines are returned (`appended: true`); otherwise the
whole file. A read retries until its before/after metadata agree and reports the
revision of exactly what it returned. SQLite: always the full document.
The frontend concatenates appended text onto an LRU cache (8 sources) and
re-parses the full transcript in a dedicated Worker. Requests carry the current
UI language; provider/user text is preserved. Parsing must finish before history
is saved or the operation guard is released. Results from a disposed sync runtime
are discarded. Worker errors/timeouts fail synchronization without falling back
to expensive UI-thread parsing; consumers without Worker keep the synchronous
parser API. Pi/omp and Claude rebuild the active branch in linear time; Claude
title lookup reuses decoded rows.

## Ownership (`native_session_probe`)

`access.holder {pid, command, provider}` accompanies `external` and
`ambiguousProcess` states. Detection (Linux `/proc`, same uid, not a MonoCode
descendant):

| provider | binary | explicit session flags |
| --- | --- | --- |
| claude | `claude`, `.../claude/versions/<v>`, `@anthropic-ai/claude-code` | `--resume`/`-r <id>`, `--session-id` |
| omp | `omp`, `/oh-my-pi/` | `--resume`/`-r`, `--session` |
| opencode | `opencode`, `opencode.exe`, `/opencode-ai/` | `--session`/`-s` |
| codex/pi | unchanged | unchanged |

Without an explicit flag, a matching CLI whose cwd equals the session cwd makes
the session `ambiguousProcess` (read-only): Claude does not keep its transcript
open and opencode shares one database, so cwd is the only relation.
