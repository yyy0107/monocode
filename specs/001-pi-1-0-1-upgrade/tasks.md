# Tasks: Pi 1.0.1 Compatibility Upgrade

**Input**: spec.md, plan.md, research.md, data-model.md and contracts/pi-adapter.md.
**State**: Implemented and validated on Linux; real-model/native-GUI and other-platform checks remain unverified as recorded in quickstart.md.
**Tests**: Meaningful regressions are required by this feature specification.
**Organization**: Story-specific phases, with file paths and requirement IDs.

## Phase 1: Setup

- [x] T001 Record source HEAD, Node/Pi/OMP versions and available environments in specs/001-pi-1-0-1-upgrade/research.md (FR-011).
- [x] T002 Establish the unverified/tested capability table in specs/001-pi-1-0-1-upgrade/quickstart.md; retain PNG, desktop-remote and text/image limits (FR-011).

## Phase 2: Foundational

- [x] T003 Extend fake-provider replay helpers in host/provider-transport.test.ts with handled commands, dialogs and PNG outcomes without real model calls (FR-009, FR-010).
- [x] T004 Verify protocol/runtime ownership and backward-compatible optional metadata against specs/001-pi-1-0-1-upgrade/contracts/pi-adapter.md before implementation (FR-008, FR-009, FR-010).

## Phase 3: US1 - Command and Run Completion (P1, initial MVP)

**Goal**: Commands finish; ongoing automatic work is not ended prematurely.
**Independent Test**: Command-only, started/queued, cancellation and exit sequences.

- [x] T005 [US1] Add failing handled-without-run and agent_end-before-settled regressions in src/integrations/harness/providers/pi/piLive.test.ts (FR-001, FR-002).
- [x] T006 [US1] Handle Pi prompt disposition and strict agent_settled completion in src/integrations/harness/providers/pi/piFamily.ts; preserve OMP response semantics (FR-001, FR-002).
- [x] T007 [US1] Cover and repair cancellation, late response, pending dialog and process-exit cleanup in src/integrations/harness/providers/pi/piFamily.ts and piLive.test.ts (FR-002, FR-008).
- [x] T008 [US1] Verify existing OMP command, retry and cancellation behavior in src/integrations/harness/providers/omp/ompLive.test.ts (FR-009).

## Phase 4: US2 - Exact Extension Interaction (P1)

**Goal**: Any choice and exact text/editor value can be answered or cancelled.
**Independent Test**: Non-first choice, prefill, whitespace/newlines, empty input and timeout.

- [x] T009 [US2] Add regressions for optional text settings and exact replies in src/features/sessions/model/userQuestion.test.ts and src/features/sessions/ui/QuestionForm.test.ts (FR-003, FR-004, FR-008).
- [x] T010 [US2] Add optional input settings in src/features/sessions/model/userQuestion.ts and multiline/prefill/hint rendering in src/features/sessions/ui/QuestionForm.tsx; preserve old defaults and existing text limit (FR-004, FR-009).
- [x] T011 [US2] Preserve raw option values, prefill, placeholder and timeout in src/integrations/harness/providers/pi/piProtocol.ts with piProtocol.test.ts coverage (FR-003, FR-004, FR-008).
- [x] T012 [US2] Wire Pi question replies in src/integrations/harness/providers/pi/piAdapter.ts and pi.ts; extend shared dialog lifecycle in piFamily.ts with one terminal reply per request (FR-003, FR-004, FR-008).
- [x] T013 [US2] Verify exact replies, expiration/cancel races and Host limits in host/engine.test.ts and src/integrations/harness/providers/omp/ompLive.test.ts (FR-004, FR-009, FR-010).

## Phase 5: US3 - Commands and Thinking Capability (P2)

**Goal**: All loaded command kinds and valid session/model thinking choices are discoverable.
**Independent Test**: Three command sources, reserved names, model change and rejected settings.

- [x] T014 [P] [US3] Add failing extension/prompt/skill parsing and invocation cases in src/integrations/harness/providers/pi/piSkills.test.ts (FR-005, FR-008).
- [x] T015 [US3] Extend Pi command discovery and reserved-name/raw invocation handling in src/integrations/harness/providers/pi/piSkills.ts and piAdapter.ts using core/nativeCommands.ts; retain legacy skill exports and OMP discovery (FR-005, FR-009).
- [x] T016 [P] [US3] Add session-scoped levels, model-switch, provider event and rejected-setting cases in src/integrations/harness/providers/pi/piLive.test.ts (FR-006, FR-008).
- [x] T017 [US3] Query active-model levels and reconcile thinking_level_changed in src/integrations/harness/providers/pi/piFamily.ts; publish existing session.configChanged events (FR-006).
- [x] T018 [US3] Add optional session capability metadata in src/integrations/harness/core/types.ts, core/apply.ts and src/features/sessions/model/session.ts; consume it in src/features/sessions/ui/ModelPicker.tsx without global catalog mutation; preserve failed-setting state and explicitly document optional-command fallback in specs/001-pi-1-0-1-upgrade/contracts/pi-adapter.md (FR-006, FR-008, FR-009).

## Phase 6: US4 - Persistent PNG Tool Results (P2)

**Goal**: PNG and text appear once and remain accessible locally and on desktop-connected Host.
**Independent Test**: Reopen, duplicate events, save failure, obsolete run and scoped remote reads.

- [x] T019 [US4] Add final-result PNG/text, invalid MIME/data, 20 MiB cap and stable-ID cases in src/integrations/harness/providers/pi/piProtocol.test.ts (FR-007, FR-008).
- [x] T020 [US4] Preserve PNG output and stable call/index image identity in src/integrations/harness/providers/pi/piProtocol.ts and piFamily.ts; retain text and reject unsupported images visibly (FR-007, FR-008).
- [x] T021 [US4] Add desktop image materialization, deduplication, cancellation-generation checks and completion waiting in src/integrations/harness/providers/pi/pi.ts and piFamily.ts; reuse platform/tauri/fs.ts image-save behavior (FR-007, FR-008).
- [x] T022 [US4] Materialize Host PNG events to session-owned attachments before reducer application in host/engine.ts and host/attachments.ts; cover failure/cleanup in host/engine.test.ts and host/attachments.test.ts (FR-007, FR-008, FR-010).
- [x] T023 [US4] Add optional attachment reference to core/types.ts image events; preserve it in core/apply.ts and render remote previews in src/features/sessions/ui/GeneratedImage.tsx and AgentTranscript.tsx, using existing scoped attachment reads (FR-007, FR-009, FR-010).
- [x] T024 [US4] Verify persisted/reopened image rows, old Codex image defaults and remote preview behavior in src/integrations/harness/core/apply.test.ts, src/features/connections/model/remoteAttachmentPreviews.test.ts and host/provider-transport.test.ts (FR-007, FR-008, FR-009, FR-010).

## Phase 7: US5 - Agent and Remote Compatibility (P1, cross-cutting)

**Goal**: Existing Agents, saved history and desktop/Host interaction paths retain their behavior.
**Independent Test**: Existing provider suites plus shared consumer and Host transport scenarios.

- [x] T025 [US5] Run affected adapter and shared question/image regressions; add any missing backward-default cases in src/integrations/harness/core/registry.test.ts and src/features/sessions/model/userQuestion.test.ts (FR-009).
- [x] T026 [US5] Add cross-session attachment authorization, reconnect and question/image parity cases in host/provider-transport.test.ts and host/attachments.test.ts (FR-009, FR-010).
- [x] T027 [US5] Verify old history rows and mobile type/old-flow compatibility in src/features/sessions/data/sessionStoreRestore.test.ts and src/mobile tests; record deferred mobile editor/image UX in specs/001-pi-1-0-1-upgrade/quickstart.md (FR-009, FR-010, FR-011).

## Phase 8: Completion and Records

- [x] T028 Run npm run check:web, npm run test:host and npm run build per package.json; run npm run check:rust if Rust changed, and record real results in specs/001-pi-1-0-1-upgrade/quickstart.md (FR-009, FR-010, FR-011).
- [x] T029 Execute isolated actual Pi 1.0.1 protocol smoke and available real CLI/model scenarios from specs/001-pi-1-0-1-upgrade/quickstart.md; mark unrun scenarios/versions explicitly (FR-011).
- [x] T030 Reconcile specs/001-pi-1-0-1-upgrade/spec.md, plan.md and tasks.md with implemented behavior and known limits; mark completed tasks only with evidence (FR-001 through FR-011).

## 2026-10-05 thinking-level regression repair

- [x] T031 Reproduce unsupported medium, model-switch stale state, and unavailable-query failures in piLive.test.ts before changing the adapter.
- [x] T032 Delegate thinking adjustment to Pi and read the effective state in piFamily.ts; preserve OMP behavior and the documented unavailable-query fallback.
- [x] T033 Verify native event/readback, Host turn completion and persisted/reconnected settings; record targeted tests, TypeScript checks and isolated Pi 1.0.3 RPC evidence in quickstart.md.
- [x] T034 Reproduce and repair Pi catalog choices/defaults that ignored thinkingLevelMap; verify initial picker selection, Host catalog discovery and unchanged OMP defaults.

## Dependencies & Execution Order

Setup -> foundational -> US1 -> US2 -> US3 -> US4 -> US5 -> completion records.
US5's checks also run after each affected story; its final phase consolidates them.
Within a story, establish failing regression behavior before implementation.
T015 follows T014; T017/T018 follow T016. T022/T023 finish before remote image acceptance.
Tasks modifying the same module remain sequential.

## Parallel Opportunities

- US1: Pi and OMP regressions can run concurrently after the repair.
- US2: question model and UI tests are separate consumers, run after shared metadata is defined.
- US3: T014 and T016 edit different test files and have no mutual implementation dependency.
- US4: desktop and Host validation can run concurrently after common image contracts exist.
- US5: existing provider suites can run independently; record results per consumer.

## Implementation Strategy

First deliver and validate US1 as the minimal compatibility repair.
Then complete US2, US3 and US4 as focused increments while re-running relevant US5 checks.
Finish all five stories and completion records before declaring the full upgrade complete.
Keep toolkit scaffolding/specification changes distinct from product commits.
