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
