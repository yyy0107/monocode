# Validation Quickstart

## Preconditions

Use the dedicated worktree and a development branch. Record git HEAD, node --version,
pi --version and the installed OMP version. Target Pi is 1.0.1.
Install existing locked dependencies with npm ci if needed; no toolkit update is required.
Use temporary config/resources for fixtures; keep user credentials out of recorded output.

## Automated Checks

```sh
npx vitest run src/integrations/harness/providers/pi src/integrations/harness/providers/omp
npx vitest run src/features/sessions/model/userQuestion.test.ts src/features/sessions/ui/QuestionForm.test.ts
npm run check:web
npm run test:host
npm run build
```

Run npm run check:rust if Rust changes. The host test command builds its TypeScript
bundle through its existing pretest script. Do not bypass tests or change production
credentials to make verification pass.

## End-to-End Scenarios

1. Command-only extension: returns handled and no run; the session becomes usable
   without Cancel. Ordinary text/retry/steer still waits for complete settling.
2. Dialog fixture: select the second option, submit multiline/whitespace text,
   edit prefill, submit empty text, cancel and let timeout expire.
3. Command fixture: one skill, extension and prompt template appear with correct
   invocations; reserved names and styled values are retained correctly.
4. Model fixture: off-only and reasoning models have correct choices; rejected
   changes do not appear active. Unsupported query fallback is explicit.
5. PNG fixture: mixed text/image final result appears once; reopen local history.
   Verify malformed/non-PNG/over-limit data, repeated end frames and save failure.
6. Headless Host: answer an interaction, save a PNG, reconnect/reopen and view it
   via session-authorized attachment reads. Cancel before a late result and ensure
   it does not append. Reject attachment access from another session.
7. Existing OMP and shared question/image consumers: execute established lifecycle,
   answer, cancellation, resume and history cases.

## Compatibility Record

Maintain a table with provider, actual version, local/Host environment, scenario,
result, command/evidence and known limit. Leave unrun real-model cases and other
platforms unverified. Specs/checklists passing does not mean product tests passed.

## Executed Verification

| Check | Result | Evidence |
|---|---|---|
| npm run check:web | PASS | 400 files, 4224 tests passed; 2 files / 13 tests skipped by existing configuration; tsc passed |
| npm run test:host | PASS | 20 files, 103 tests passed; 1 file / 5 tests skipped by existing configuration |
| npm run build | PASS | TypeScript and Vite production build succeeded |
| Pi 1.0.1 RPC smoke | PASS | Loaded extension/prompt/skill commands, handled replies, select/confirm, empty input, exact multiline editor and thinking-level query; zero agent starts/model calls |
| Pi 1.0.2 additional RPC smoke | PASS | Same isolated protocol cases; zero agent starts/model calls |
| OMP protocol regression | PASS (fixtures) | Existing 31 live cases and related shared suites |
| PNG local/runtime validation | PASS (fixtures) | Header/CRC/size checks, awaited persistence, duplicate events, cancellation discard, shared history and preview tests |
| PNG Host/reconnect validation | PASS | Real Node file/SQLite persistence, session-owned chunk reads, reconnect snapshots and write-failure cleanup |

Source baseline: 6527b3a21dbff258bad77b03fddca3a98e4822ec.
Node: v24.16.0 on Linux. Worktree branch: codex/pi-1-0-1.
Dependencies installed from the existing lockfile with npm ci.
Full validation ran against the isolated implementation copy before hash-verified application to the worktree.
Git/subprocess tests require execution outside this host's command sandbox;
initial sandbox EPERM failures were rerun successfully, without disabling tests.
No Rust source changed, so no new Rust check result is claimed.
The Vite build emits the repository's existing large-chunk warning; the build succeeds.

## Real RPC Smoke

The reusable script creates temporary Pi config and resources, automatically answers
its own fixture dialogs, checks production command/UI mappers, asserts zero agent
starts, and removes its temporary data. It does not invoke an ordinary model prompt.

```sh
node scripts/pi-rpc-smoke.mjs --binary /path/to/pi-1.0.1
node scripts/pi-rpc-smoke.mjs --expected-version 1.0.2
```

The first command keeps the target version explicit. The second is the additional
current-global-version check performed during this implementation.

## Compatibility and Limits

| Capability/environment | Status | Limit |
|---|---|---|
| Pi 1.0.1 / 1.0.2 RPC command and dialog shapes | Tested | No model calls in smoke |
| Other real Pi versions | Unverified | No compatibility claim from version-parser samples |
| Real OMP CLI | Unverified | Not installed; automated protocol regressions passed |
| Other Agent shared behavior | Automated suites passed | Real authenticated model sessions were not exercised |
| Generated output images | PNG supported | 20 MiB decoded cap; other formats produce visible errors |
| Editor/input replies | Supported on desktop and desktop-connected Host | 10000 characters; preserve whitespace and empty submitted values |
| Linux native Tauri GUI launch | PASS | Built from this worktree with npm run tauri:stable; native window and worktree Vite service confirmed |
| Linux native image-save end-to-end | Unverified | Adapter/materializer/UI tests passed; real generated-image GUI flow was not exercised |
| Paid-model chat/image generation and real MCP servers | Unverified | Not contacted by tests |
| macOS / Windows | Unverified locally | Existing CI can add evidence |
| Mobile new multiline/generated-image UX | Deferred | Existing mobile tests/types passed; no new mobile UX claim |
| New MCP management UI, widgets, full session tree and native queue ownership | Deferred | Existing Pi configuration and Monocode queue behavior remain |

## Local Main Integration

Integrated feature commit 45ac611 into local main based on cfb49eb. Resolved the
GeneratedImage merge by retaining the mobile TranscriptPlatformContext reader and
the Pi remote-attachment preview path. Added a regression for existing images
using the client platform reader. The original 22 tracked-file edits and two
untracked files were restored; tracked additions/deletions and untracked hashes
were compared with the pre-merge backup and matched.

Validation on the merged main worktree, including its restored local edits:

| Check | Result |
|---|---|
| npm run check:web | PASS: 403 files / 4263 tests; 2 files / 13 tests skipped; TypeScript passed |
| npm run test:host | PASS: 20 files / 107 tests; 1 file / 5 tests skipped |
| npm run build | PASS: TypeScript and Vite production build |
| Pi 1.0.1 RPC smoke | PASS: commands, handled replies, dialogs and thinking query; zero model calls |
| Pi 1.0.2 RPC smoke | PASS: same isolated cases; zero model calls |

No Rust source changed in this merge. The currently running desktop remains the
Pi feature-worktree instance; merged-main GUI launch and real generated-image GUI
flows were not exercised by these checks. No remote push was performed.

## 2026-10-05 unsupported-thinking repair

The catalog defaults reasoning models to `medium`, while a live Pi model can
advertise a narrower set. The adapter previously threw before sending the turn.
It now lets Pi resolve the level and reads back actual state after thinking/model
changes. Missing optional capability discovery retains the native setting.

| Check | Result |
|---|---|
| New regression cases before repair | 4 expected failures: unsupported medium with/without native event, off-only model switch, unavailable capability query |
| `npx vitest run src/integrations/harness/providers/pi/piLive.test.ts src/integrations/harness/providers/omp/ompLive.test.ts` | PASS: 56 tests |
| `npx vitest run --config host/vitest.config.ts host/provider-transport.test.ts -t 'Pi\|pi\|omp'` | PASS: 21 tests; 6 excluded by filter. Includes two turns with a stale default and persisted/reconnected effective settings |
| `npx tsc --noEmit` | PASS |
| `npx tsc --noEmit -p host/tsconfig.json` | PASS |
| Installed Pi `1.0.3`, Node `v24.16.0`, isolated offline RPC fixture | PASS: custom model with levels off/high maps medium to high; switching to a non-reasoning model maps medium to off; zero agent starts/model prompts |

The real RPC fixture used a temporary agent directory and dummy localhost
provider, with extensions, skills, templates, context files and tools disabled;
temporary data was removed. Host tests emitted title-generation teardown
diagnostics but passed. No authenticated DeepSeek generation or native desktop
GUI run was performed; this repair is in source and has not been packaged or
deployed. Existing unrelated working-tree changes were preserved.

Follow-up: the initial picker exposed every generic level because catalog parsing
ignored `thinkingLevelMap`. Catalog choices now follow the installed Pi 1.0.3
capability rules, including null-disabled levels and explicitly mapped xhigh/max;
the default is selected from those choices. Live capabilities still override the
catalog for the active session. OMP catalog choices/defaults are unchanged.

- Three new catalog regressions failed before repair and passed afterward.
- `npx vitest run src/integrations/harness/providers/pi/piProtocol.test.ts src/integrations/harness/providers/pi/piCatalog.test.ts src/features/sessions/ui/ModelPicker.test.ts`: 55 passed.
- Additional UI regression: `npx vitest run src/features/sessions/ui/ModelPicker.test.ts -t 'unsupported Pi thinking'`: 1 passed, 24 filtered out; proves the pre-session menu offers only off/high and selects high.
- `npx vitest run --config host/vitest.config.ts host/provider-transport.test.ts -t 'discovers host models'`: 1 passed, 26 filtered out; verifies restricted Pi catalog/default through real subprocess I/O and retained OMP default.
- Web and Host `tsc --noEmit` checks passed after the catalog implementation change.
