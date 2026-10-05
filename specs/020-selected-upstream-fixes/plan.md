# Integration plan

Prepare independent detached worktrees from the fork baseline. Reuse installed
Node dependencies and validate focused upstream regressions against each port.
Keep the active desktop-shell specification and unfinished main-checkout changes
untouched. Combine reviewed commits in an isolated integration worktree.

1. Small fixes: `c7de48f`, `e65ed82`, `a541016`, `6a5f7fa`. Preserve Pi/OMP
   separation, fork navigation, localized controls and native question fields.
2. Attachment lifecycle: adapt `56bae44`; retain remote capabilities and owned
   error localization. Folder staging: combine `fb55b25`, `60102ab`, `4361fdb`
   with shared AnimatedCollapse and translated actions.
3. Scroll behavior: selectively port `7933972` without replacing the fork's
   AgentMarkdown/wordFade APIs. Reuse existing scrollGeometry for programmatic
   offsets and isolate nested-wheel input before reader-state changes.

Run the combined web checks, Host checks and production build sequentially to
avoid the known lazy-import test flake under overlapping builds. The folder port
also requires fmt, all-target clippy and Rust tests. A temporary desktop-host
asset link satisfies Tauri compile-time resource discovery without changing
source or claiming a newly packaged Host artifact.

Finally, preserve the live index and working-file contents while advancing main
through the reviewed commits. Use three-way reconciliation, concurrency checks
and backups for dirty shared files. Leave unrelated changes uncommitted and do
not push. Record actual checks, versions and unavailable native/live-provider QA.
