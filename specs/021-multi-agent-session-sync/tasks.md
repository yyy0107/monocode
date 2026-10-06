# Tasks

- [x] T001 Read constitution and feature 002 artifacts; inspect real Claude 2.1.289, omp 18.6.0 and OpenCode 1.18.34 storage (created one omp and one OpenCode session in a scratch directory).
- [x] T002 Rust provider source table, Claude/omp headers, OpenCode read-only listing/reading, incremental JSONL reads; unit tests.
- [x] T003 Provider argv/flag detection, holder reporting, per-conversation SQLite lock keys; unit and process tests.
- [x] T004 `notify` watcher with debounce and discovery directories; unit test.
- [x] T005 Widen store lookups (`session_find_native_id` with account, `session_list_provider_bindings`).
- [x] T006 Claude and OpenCode parsers, omp flavor of the Pi parser; sanitized fixture tests incl. Pi regressions.
- [x] T007 Strict resume for Claude, omp and OpenCode with regressions (Pi regressions kept).
- [x] T008 Data layer: text cache, observe path, watcher events, holder hint, quiet discovery; tests.
- [x] T009 Sidebar external sessions group, Settings panel providers, zh-CN labels.
- [x] T010 Run check:web, test:host, build, check:rust; record evidence in compatibility.md.
- [ ] T011 Desktop GUI end-to-end scenarios for each provider (see compatibility.md: untested).
- [x] T012 Move native import into its own Settings → Import section: auto-sync card (toggle, imported count, sync now) and a per-app list (logo, detected/not-imported counts, expandable conversation list with search, Import/Open); tests and zh-CN labels.
- [x] T013 Import speed: backend strips rows/fields the parsers never read before IPC (order-preserving; 968 real sessions parse byte-identically, 2603 MB -> 462 MB), shared 1 s /proc snapshot for display probes (writes still scan fresh; zombies count as exited), batch import with read-ahead, link-only poll/sync (`session_list_native_links`) so closed imports are not loaded every 5/30 s, and no app re-render for closed imported sessions.
