# Compatibility record (2026-10-05, Linux)

## CLI versions on the test machine

| CLI | version |
| --- | --- |
| claude | 2.1.289 (Claude Code) |
| codex | codex-cli 0.160.0 |
| pi | 1.0.3 |
| omp | omp/18.6.0 |
| opencode | 1.18.34 |

## Tested

- Real discovery (`list_all` against this machine): 35 Claude, 203 Codex,
  727 Pi, 1 omp, 1 OpenCode session; OpenCode read from the live WAL database
  in read-only mode. Pre-existing warnings: Codex files above the 64 MiB limit.
- Real parsing: all 35 Claude transcripts parse; the omp session created with
  `omp -p` parses (model `omp:ollama/...`). One Claude file holding only system
  rows is now excluded from discovery.
- Real ownership: probing this machine's live Claude Code transcript reports
  `ambiguousProcess` with the running `claude` pid as holder.
- Unit/regression suites listed in tasks.md; `npm run test:host` 249 passed;
  `npm run build` passed; `cargo fmt --check` and `cargo clippy -D warnings`
  clean; `tsc --noEmit` clean.

## Environment notes on the checks

- `npm run check:web` passes all new and affected tests when run with an
  English locale (`LANG=en_US.UTF-8`). The machine default `zh_CN` makes
  pre-existing tests that assert English strings fail (including untouched
  Codex import tests). Two full runs each had one unrelated file time out under
  load (`ProjectSessionSection.test.ts`, then `FilePaneNavigation.test.ts`);
  both pass alone (52/52, 11/11).
- `cargo test`: 533 passed; the two `fs::tests::git_stash_*` tests fail under
  the Chinese git locale and pass with `LC_ALL=C` (unrelated to this feature).

## Untested

- Desktop GUI scenarios for every provider: external sessions appearing in the
  sidebar, click-to-import, sub-second transcript updates while a CLI writes,
  composer unlock after CLI exit, Monocode continuing the same id and the CLI
  then showing that turn, and a CLI resumed during a MonoCode turn.
- Real Claude/omp/OpenCode resume launched by MonoCode (covered only by adapter
  tests with fake processes).
- omp session-directory overrides (`--session-dir`, `--profile`): such sessions
  are not discovered.
- macOS/Windows: watcher compiles via `notify`, but ownership stays
  `unsupportedPlatform` (read-only).

## Desktop responsiveness repair (2026-10-05)

Fixed five regressions found in the existing dirty workspace: orchestration
single-session reads now use the live value or cached ID lookup instead of
enumerating history; routine refreshes skip submission checks; public RPC brain
privacy checks reuse the snapshot cache; sash frames keep chat/editor props
stable; native discovery events coalesce within 10 seconds with a trailing
refresh; native transcript decoding and branch reconstruction run in a Worker.
The first two changes address the same Host enumeration regression. Existing
brain privacy, retired/missing sessions, titles, source ownership and incremental
read behavior remain covered by focused regressions.

Observed tools: Node v24.16.0, TypeScript 5.8.3, Vitest 3.2.7 and Vite 7.3.6.
No new real-provider execution or CLI compatibility claim is made here.

Executed checks:

| Command / check | Actual result |
| --- | --- |
| `npx vitest run --config host/vitest.config.ts host/engine.test.ts host/server.test.ts host/orchestration.test.ts host/assistant/index.test.ts host/legacy-orchestration.test.ts host/desktop-import.test.ts` | 103 passed |
| `npx vitest run src/features/workspace/ui/PaneTreeResize.test.ts src/features/workspace/ui/PaneTreeSurfaces.test.ts` | 15 passed; 10 sash frames keep each memoized chat/editor at one render |
| `npx vitest run src/features/sessions/data/nativeSessions.test.ts` | Final run: 22 passed, including throttled/trailing discovery, async save guards and disposed results/errors |
| Parser tests: `nativeSessionParsing.test.ts`, `nativeSessionParser.worker.test.ts`, `core/nativeSessionParser.test.ts`, `core/nativeTitles.test.ts` and the Pi, Claude, Codex, OpenCode `*SessionImport.test.ts` files | Initial run: 33 passed; final strengthened client file: 8 passed (34 distinct tests across these files) |
| `npx tsc --noEmit -p host/tsconfig.json` and final `npm run host:build` | Both passed; final Host bundle built |
| `npm run build` | Blocked by unrelated `src/mobile/composerStylePreview.tsx:25` TS2741: missing `ModelSetting.kind`; preserved that existing preview file |
| TypeScript with the original config, temporarily excluding only that preview and preserving repository type roots | Passed; temporary config removed |
| `npx vite build` | Passed, including `nativeSessionParser.worker` asset; existing CSS highlight / chunk-size warnings remain |
| Focused `git diff --check` | Passed |

A disposable Node worker-thread bridge executed the browser-targeted parser
bundle without a window/PTY runtime. A synthetic 51.1 MiB Pi transcript with
25,000 blocks matched the synchronous result's count and final text. Synchronous
parsing occupied 90.2 ms; posting the Worker request took 17.9 ms, and 22 main
thread heartbeat ticks ran while background parsing completed. These timings
are Node evidence, not WebKit frame-rate measurements. Whole-text/result cloning
and history persistence still have a cost; this repair removes JSON decoding
and branch reconstruction from the desktop UI thread.

The Host orchestration test teardown printed a pre-existing `database is not
open` warning while all tests passed. Rust was not changed or checked in this
repair. Native desktop interaction profiling and macOS/Windows acceptance were
not run. The running user desktop/Host was not restarted or replaced, and no
push, merge or publication was performed.
