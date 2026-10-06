# Verification and operating record

Implemented against `fe48e80302a7137276d708f2fe83d4df7becd945` on the personal
fork. Existing desktop sidebar/project/hover changes were retained. No publish,
push, merge or installation into the user's running desktop is included.

## Operation

Build/restart the development desktop to load the native bootstrap and bundled
Host together. Bootstrap requires lifecycle `sharedDesktop: 2` and
`orchestrationHost: 1`; it refuses to replace an older Host with running turns or
active orchestration. Remote desktop uses the `sessions.orchestration` capability;
an older Host needs its own upgrade before controls are available.

Select Orchestrate in the composer, generate assignments, review/edit them and
confirm. Confirmation uses the current session revision; Resume, Stop and task
cancel use the independent orchestration ID. Lead cards contain controls and
worker details even when the sidebar is compact. Worker conversations are read
only. Phone clients continue to read history and status.

Host owns accepted execution. Reconnecting desktop reads its state; restarting
Host pauses unfinished runs. Resume reuses the saved worker conversation,
checkout and baseline. Inspect any error or recovery blocker before resuming.
Conflict, scope violation, unsupported file changes or occupied cleanup preserve
the worker checkout for inspection.

Native bootstrap persists a single exact legacy manifest and rejects later
writes to its IDs. The Host owner stops only those sessions, removes imported
copies and stores permanent source tombstones; native source deletion follows.
Retries use the same manifest, including after either side crashes. Legacy code,
worktrees, branches and checkpoint files are not removed. The ordinary importer
only reads its source database.

## Tools observed on 2026-10-05

| Tool | Actual version |
| --- | --- |
| Node / npm | 24.16.0 / 12.0.1 |
| TypeScript / Vitest / Vite | 5.8.3 / 3.2.7 / 7.3.6 |
| Rust / Cargo | 1.96.0 (2026-05-25) |
| Git / Tauri CLI | 2.53.0 / 2.11.4 |
| Codex CLI | 0.160.0 |
| Claude Code | 2.1.289 |
| Pi | 1.0.3 |
| OMP | 18.6.0 |
| OpenCode | 1.18.34 |
| Cursor agent | 2026.10.01-e373342 |
| Grok | 1.0.46 (2765805b9442) |
| Fx | 0.0.12 |
| Hermes | 0.21.5+6977.gaf90026 (2026.9.24) |
| Antigravity | Executable unavailable |

Version observations are not real-model compatibility claims. Provider protocol
fixtures exercise Pi and OMP independently through production adapters. Optional
capabilities remain provider-specific: Fx auto-allows permissions; Fx, Hermes and
Antigravity do not provide the same question API; Grok, Fx and Antigravity lack
worker steering. They do not gain capabilities from this migration.

## Verification scope

Tests use actual SQLite databases, Git repositories and spawned Node/provider
protocol fixtures. They cover stale edits and generations, repeated confirmation,
receipt retries, worker input, scope checks, retained recovery, public API ownership,
dirty checkout seeding, shell changes, binary/mode/deletion changes, conflicts,
partial integration, occupied cleanup, source retirement and workspace/outbox
resurrection. Bundled CLI tests start a detached Host, reconnect through desktop
bootstrap, retire imported copies and restart without reimporting them.

All four automated gates passed again in the continuation; counts are recorded in
`tasks.md`. That build reported CSS highlight optimizer warnings and large
chunks. Unrelated UI suites emit React act warnings.

## Unverified environments and limits

Real Pi 1.0.3 orchestration passed an isolated execution smoke test with the
configured `openai-codex/gpt-6.1-sol` model: planning, reviewed editing and
idempotent confirmation, one worker, lead control CLI review/integration, exact
result bytes and finish/authorization cleanup. OMP 18.6.0 with its configured
local `ollama/wx-memory-qwen3:14b` model completed planning and the worker but
timed out before lead review/integration; two invalid native Subagent calls
were observed. Its end-to-end acceptance remains open. Hosted OMP models were
not available in this test catalog. Detailed evidence and retained artifact
paths are in `tasks.md`.

A manual native desktop window close/reopen with active orchestration and Host
restart/manual resume have not been exercised. Protocol fixtures, client tests
and these engine smoke tests do not establish that manual acceptance. No physical phone acceptance,
Windows or macOS execution was run in this Linux session; platform-only tests are
skipped as indicated by the test results. Antigravity real/soak tests require its
unavailable executable and opt-in environment.

Scope enforcement checks provider-reported writes and the complete worker
checkout before review. This is not an OS sandbox for unreported shell writes
outside the checkout. Large/unsupported files and symlinks are retained for
manual review instead of silently integrated.

Shared reservations protect application file/Git writes, native harness processes
and terminals during integration and cleanup. The Host lead stays available to
request review while workers run. Arbitrary lead shell writes and external
programs do not acquire those reservations; HEAD/index/target rechecks detect
conflicts, but they do not provide an OS-level write fence against such programs.
