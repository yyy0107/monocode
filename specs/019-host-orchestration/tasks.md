# Tasks

- [x] Portable scheduler and Host persistence/recovery.
- [x] Host planning, reviewed proposal commands and execution ownership guards.
- [x] Host loopback control CLI and managed provider environment.
- [x] Seeded worker worktrees, checkpoints, integration and safe cleanup.
- [x] Shared checkout/resource reservation protection.
- [x] Desktop Host projection/actions, capability, model picker and worker UI.
- [x] Durable legacy retirement and workspace/import resurrection protection.
- [x] Host/Git/client/native regressions and required automated verification.
- [x] Documentation and actual version/verification evidence.
- [ ] Manual native desktop close/reopen with an active run and Host restart/manual resume.
- [x] Real-model Pi planning, reviewed confirmation, isolated worker execution and integration acceptance.
- [ ] Real-model OMP planning, reviewed confirmation, isolated worker execution and integration acceptance.
- [ ] Physical phone history/status acceptance and Windows/macOS runtime acceptance.

## Evidence

Planning baseline: 4 existing orchestration suites, 77 tests passed with Vitest
3.2.7. This is scheduler baseline evidence, not Host implementation verification.

Final automated gates on 2026-10-05, all exit code 0:

| Command | Result |
| --- | --- |
| `npm run check:web` | 480 test files passed, 2 skipped; 5,046 tests passed, 13 skipped; TypeScript passed |
| `npm run test:host` | 34 test files passed, 1 skipped; 249 tests passed, 5 skipped |
| `npm run build` | Production web and bundled Host build passed |
| `npm run check:rust` | Formatting and Clippy with warnings denied passed; 527 tests passed, 1 ignored |
| `git diff --check` | Passed |

The Host gate includes the original desktop-upgrade regressions and the new
active-orchestration upgrade guard. Pi and OMP protocol fixtures each use the
production adapter with a spawned fixture process. Bundled CLI regression starts
a detached Host, reconnects through desktop bootstrap, retires imported legacy
copies, restarts and verifies no reimport. These are automated tests, not manual
native-window or paid-model acceptance.

Actual CLI versions, existing warnings and unverified scenarios are recorded in
[quickstart.md](quickstart.md). No running desktop installation, user-record
deletion, push, publish or merge was performed during implementation. Legacy
retirement runs when the rebuilt native desktop first bootstraps its Host.

## Continuation verification (2026-10-05)

The implementation tasks above were already checked when this continuation began.
The continuation verified the existing code and exercised the real provider path
in an isolated temporary Git repository and Host database. Existing unrelated
working-tree changes were retained; the active feature pointer was subsequently
changed to feature 021 by concurrent work and was not overwritten.

All required gates passed again, with exit code 0:

| Command | Result |
| --- | --- |
| `npm run check:web` | 487 files passed, 2 skipped; 5,141 tests passed, 13 skipped; TypeScript passed |
| `npm run test:host` | 34 files passed, 1 skipped; 249 tests passed, 5 skipped |
| `npm run build` | Production build passed |
| `npm run check:rust` | Formatting and Clippy with warnings denied passed; 535 tests passed, 1 ignored |

Focused Host/client validation additionally passed 12 files / 123 tests. The full
gates include the other working-tree changes present during their execution.

Pi 1.0.3, using its configured `openai-codex/gpt-6.1-sol` model through the
production Host adapter, passed real planning, reviewed proposal editing,
idempotent repeated confirmation, one isolated worker, lead-driven control CLI
review/integration, exact result-byte checks and finish/authorization cleanup.
The test retained its private artifacts under
`/tmp/monocode-real-pi-acceptance-wMWbdh`; its execution log is
`/tmp/monocode-implement-real-pi.log`. This is a real-model execution smoke test,
not native desktop, phone, platform or restart/resume acceptance.

OMP 18.6.0 exposed only three local Ollama models. With its configured
`ollama/wx-memory-qwen3:14b` model, real planning, proposal editing, repeated
confirmation and an isolated worker completed. The lead invoked the native
Subagent tool twice without its required `tasks` array instead of reviewing via
MonoCode control. The 300-second execution acceptance budget expired before
integration/finish; the test exited 1 and the OMP acceptance task stays open.
Host shutdown retained the worker checkout and result for inspection under
`/tmp/monocode-real-omp-acceptance-j8JaYV`; the log is
`/tmp/monocode-implement-real-omp.log`. This observed model/tool behavior does
not establish an adapter defect or hosted OMP model compatibility.

Versions read again: Node 24.16.0, npm 12.0.1, TypeScript 5.8.3, Vitest 3.2.7,
Vite 7.3.6, Rust/Cargo 1.96.0, Git 2.53.0, Tauri CLI 2.11.4, Pi 1.0.3 and
OMP 18.6.0. Build advisories were CSS highlight optimization and large chunks.
Final `git diff --check` passed. No native-window, physical-phone or
Windows/macOS acceptance is claimed by this continuation.

The production CLIs also wrote six new JSONL test conversations and two OMP
diagnostic logs to their default native-history directories. After provider
shutdown, the four directories belonging to the two unique acceptance cwd roots
were archived under each root's `native-history/`. Every JSONL session header
was checked against the owned cwd, and all eight files were SHA-256 checked
after the move. `native-history-manifest.json` records original/archive paths
and checksums. Existing provider histories were preserved.
