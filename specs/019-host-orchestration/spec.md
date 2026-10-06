# Host orchestration

Date: 2026-10-05. Personal fork; local implementation.

Desktop orchestration currently owns its scheduler, control endpoint and worker
processes in the renderer/native window. Ordinary conversations now belong to
Host, so their orchestration entry is unavailable. Move the execution owner to
Host while retaining the existing reviewed-proposal workflow.

## Requirements

- Local and remote desktop clients can plan, edit and confirm assignments,
  inspect workers, cancel tasks, stop runs and resume paused runs.
- Host owns all scheduler state, processes, command receipts, worker checkouts
  and checkpoints. Closing desktop must not stop accepted work. Reconnection
  reads state without triggering recovery or duplicate execution.
- Host restart pauses unfinished runs; explicit Resume reuses retained worker
  conversations/checkouts. No automatic replay of uncertain Git operations.
- Preserve task dependency/scope scheduling, 1–4 workers, reviewed integration,
  provider-specific optional controls, and lead-owned worker approvals/questions.
- Mobile continues to read shared history/status; no mobile orchestration UI.
- Delete legacy orchestration leads, workers and run records once, including
  already imported Host copies. Preserve all code, worktrees and branches.
- Preserve unrelated desktop-shell changes and ordinary/native conversations.

## Acceptance

New/old Host capability handling; repeated confirmation and uncertain command
retries cannot duplicate workers. Stale proposal/run actions are rejected.
Worker history is available through read-only details, not ordinary chat lists.
Dirty checkout seeding, opaque shell edits, binary/mode/deletion changes,
conflicts, partial integration and occupied checkout cleanup have real Git tests.
Legacy cleanup is crash-retryable and cannot resurrect retired IDs through
import, delayed writes or workspace stubs. Record actual verification and limits.
