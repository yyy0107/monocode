# Implementation Plan: Pi 1.0.1 Compatibility Upgrade

**Branch**: `codex/pi-1-0-1` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: Personal-fork upgrade described by the five user stories.
**State**: Implemented; required Linux checks passed. Evidence and limitations are recorded in quickstart.md.
**Agent context**: AGENTS.md records this feature; the installed CLI does not bundle an agent-context update script.

## Summary

Repair Pi request/run completion, connect its dialogs to shared question UI,
discover loaded command kinds and model-specific thinking choices, and preserve
PNG tool images through desktop and Host attachment paths. OMP remains an
independent protocol flavor. MCP management, widgets and tree/queue redesign are deferred.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19, Node 24 for Host; existing Rust/Tauri backend.
**Primary Dependencies**: Existing Pi subprocess RPC, Vitest, esbuild and Tauri APIs; no new dependency.
**Storage**: Existing session store and Host SQLite/attachment directory; no planned schema migration.
**Testing**: Pure protocol cases, live-adapter replay, shared question/reducer tests,
headless provider transport and actual Pi 1.0.1 smoke.
**Target Platform**: Linux desktop and desktop-connected remote Host initially.
**Project Type**: Existing desktop application with shared headless provider adapters.
**Performance Goals**: Bounded image writes; no image base64 in rendered text or persisted Host snapshots.
**Constraints**: PNG images capped at 20 MiB to fit existing remote attachment limits;
remote text replies capped at the existing 10,000 characters.
**Scale/Scope**: Five stories; Pi/OMP, questions, image attachment rendering and Host persistence.

## Constitution Check

- Personal fork: no upstream publication or issue/PR requirement.
- Shared contracts: optional question/image additions; old providers retain defaults.
- Protocol isolation: Pi disposition/settled semantics remain separate from OMP.
- Evidence: target Pi 1.0.1 verified; OMP version and full application results still to record.
- Validation: each protocol repair gets a failing regression; shared/Host consumers are covered.
- Post-design result: PASS. PNG/remote-desktop scope is explicit; no broad rewrite or new dependency.

## Project Structure

### Documentation (this feature)

```text
specs/001-pi-1-0-1-upgrade/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/pi-adapter.md
  checklists/requirements.md
  tasks.md
```

### Source Code (repository root)

```text
src/integrations/harness/providers/pi/
  pi.ts, piFamily.ts, piProtocol.ts, piAdapter.ts, piSkills.ts, piCatalog.ts
src/integrations/harness/providers/omp/
  ompAdapter.ts, ompLive.test.ts
src/integrations/harness/core/
  types.ts, registry.ts, apply.ts
src/features/sessions/
  model/userQuestion.ts
  ui/QuestionForm.tsx, AgentTranscript.tsx, GeneratedImage.tsx
src/features/connections/model/
  remoteAttachmentPreviews.ts, remoteAttachments.ts
host/
  engine.ts, attachments.ts, providers.ts, provider-transport.test.ts
```

**Structure Decision**: Extend existing modules with optional fields and small pure
mappers. Avoid moving all providers or changing the shared lifecycle API wholesale.

## Phase 0: Research

Evidence and decisions are in [research.md](research.md). Source baseline is
6527b3a21dbff258bad77b03fddca3a98e4822ec. Current main differs in Pi model-provider
metadata only, so these compatibility findings also apply to the new worktree.
The actual RPC/adapter audit reproduced handled-without-run, first-option selection,
cancelled input/editor responses and discarded image content.
Architecture research identified missing multiline/whitespace semantics and missing
Host image materialization; neither is treated as already implemented.

## Phase 1: Design

1. Interpret Pi prompt disposition. A handled command without a run finishes its
   submission; started/queued model work waits for agent_settled. agent_end alone
   cannot end a Pi 1.0.1 run. Preserve OMP agentInvoked/prompt_result handling.
2. Promote question bridging to Pi and wire piAdapter.respondQuestion. Retain raw
   selection values and timeout/prefill/placeholder metadata. Add optional text
   input settings to UserQuestion, preserving old providers' defaults.
3. Parse all three get_commands sources into NativeCommand. Reuse reserved-name
   invocation rules and keep OMP command discovery/update events separate.
4. Query thinking levels for the active session/model, not the global model list.
   Synchronize thinking_level_changed and update local state only after success.
   Unknown optional commands produce explicit fallback/unavailable handling.
   Add optional per-session model-setting choices to session.configChanged and
   runtime session state (refreshed after restore); ModelPicker prefers that session metadata to global
   defaults. Existing providers omit it and retain current behavior.
5. Extract final PNG tool blocks with stable call/index IDs. Desktop materializes
   through the existing image save function and waits before run completion.
   Host validates run ownership, saves a bounded image in its attachment directory,
   and converts it to a path event carrying an optional ordinary attachment reference.
6. Keep image block metadata and its attachment reference together in apply.ts.
   Render remote data/previewUrl through existing scoped attachment download;
   never read a Host-private path as a desktop-local file. Fail visibly, avoid
   partial references, deduplicate, and discard late cancelled-generation results.
7. Keep question additions optional for mobile/type compatibility. Full mobile
   multiline/image UX is a separately scoped change; this spec's remote UI is desktop.

Data and state rules: [data-model.md](data-model.md).
Protocol and shared interface contract: [contracts/pi-adapter.md](contracts/pi-adapter.md).
Validation procedure: [quickstart.md](quickstart.md).

## Implementation Notes

- Pi slash commands while busy use prompt with steering behavior and an extended
  acknowledgement deadline; they do not finish the active run.
- Refresh native state after settling/handled commands, including model/levels changed by extensions.
- Pi interaction ids survive process replacement so stale replies cannot answer a new dialog.
- PNG signature, chunk CRCs, dimensions and encoded/decoded size are validated.
- Nested codemode child images remain private; only forwarded outer-tool results are displayed.
- Host rolls back an unsaved image reference and removes its file if database persistence fails.

## Validation and Delivery

Development: run targeted Pi/OMP, question, image and Host tests.
Completion: npm run check:web; npm run test:host; npm run build.
If implementation changes Rust, also npm run check:rust.
Use fake executables for repeatable tests and isolated temporary config for actual
CLI protocol smoke. Record real-model coverage and untested platforms separately.
The executed validation table in quickstart.md is the completion evidence.

## Complexity Tracking

No constitution violations identified. Host image persistence and optional question
fields are necessary to meet explicit remote-history and exact-editor outcomes.
