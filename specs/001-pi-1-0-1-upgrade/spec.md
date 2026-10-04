# Feature Specification: Pi 1.0.1 Compatibility Upgrade

**Feature Branch**: `codex/pi-1-0-1`
**Created**: 2026-10-03
**Status**: Implemented; Linux automated tests and Pi RPC smoke verified. See quickstart.md for explicit limits.
**Input**: Use Spec Kit for the Pi upgrade in the user's personal fork,
preserving other Agents and remote sessions.

## User Scenarios & Testing

### User Story 1 - Commands Finish Correctly (Priority: P1)

As a Pi user, I can execute a command that answers immediately and continue
without cancelling a falsely running turn.

**Why this priority**: An already-handled command can currently leave the adapter busy.
**Independent Test**: Run a command-only extension and an ordinary conversation separately.

**Acceptance Scenarios**:
1. **Given** an idle session, **When** a command finishes without starting model
   work, **Then** its submission ends and another message can be sent.
2. **Given** pending automatic work, **When** one agent attempt ends, **Then**
   the session remains busy until automatic work settles.
3. **Given** running or waiting work, **When** cancelled or the agent exits,
   **Then** pending work and interactions are released once.

### User Story 2 - Answer Extension Questions (Priority: P1)

As a Pi user, I can select any option, confirm or decline, enter text and edit
prefilled multiline content, with my exact answer delivered.

**Why this priority**: Text responses are cancelled and selections use the first option.
**Independent Test**: An extension presents each interaction without a model call.

**Acceptance Scenarios**:
1. **Given** three choices, **When** the second is selected, **Then** the extension receives it.
2. **Given** text/editor input, **When** submitting whitespace and newlines,
   **Then** the exact text is delivered; prefill and input hints are visible.
3. **Given** an interaction, **When** dismissed, expired or its session stops,
   **Then** no stale response affects a later interaction.
4. **Given** styled labels, **When** displayed, **Then** control codes are hidden
   and original response values remain unchanged.

### User Story 3 - Discover Commands and Valid Thinking Choices (Priority: P2)

As a Pi user, I can discover loaded skills, extension commands and prompt templates,
and select a thinking level supported by the current model.

**Why this priority**: Loaded commands are hidden and choices can be misleading.
**Independent Test**: Load one resource of each kind and change model capabilities.

**Acceptance Scenarios**:
1. **Given** loaded commands, **When** opening the picker, **Then** each valid
   command kind is available with its correct invocation.
2. **Given** a model change, **When** thinking choices change, **Then** choices
   and active selection reflect the model before another submission.
3. **Given** a failed setting or unsupported query, **When** it returns,
   **Then** the UI uses an explicit fallback or reports the failure without
   claiming an unapplied value is active.

### User Story 4 - View Pi Tool Images (Priority: P2)

As a Pi user, I can view PNG results alongside tool text, and see them again
after reopening a local or remote conversation.

**Why this priority**: Image content is currently discarded.
**Independent Test**: Replay mixed text/PNG results locally and through remote Host.

**Acceptance Scenarios**:
1. **Given** a text/PNG result, **When** the tool completes, **Then** both appear
   once and encoded image data is not shown as conversation text.
2. **Given** a saved image turn, **When** reopening local/remote history,
   **Then** the image remains accessible through the existing image display.
3. **Given** malformed, oversized or non-PNG content, **When** received,
   **Then** a clear unsupported/failed-result indication appears without a crash
   and usable text remains visible.

### User Story 5 - Preserve Other Agents and Remote Sessions (Priority: P1)

As the fork owner, I can upgrade Pi while retaining OMP, other installed Agents,
saved conversations and supported remote interactions.

**Why this priority**: Pi/OMP share implementation and Host reuses adapters.
**Independent Test**: Adapter, shared-state and headless transport regressions.

**Acceptance Scenarios**:
1. **Given** OMP, **When** commanding, answering, steering, cancelling or resuming,
   **Then** its established behavior remains.
2. **Given** saved history, **When** opened after the upgrade, **Then** history
   and provider binding remain readable.
3. **Given** remote Pi, **When** answering questions or reopening image history,
   **Then** supported outcomes match local sessions.

### Edge Cases

- Completion before acceptance, cancellation races and repeated terminal events.
- Retry, steering or automatic continuation between agent end and idle.
- Dialog expiration while editing; styled option values, whitespace and newlines.
- Duplicate/malformed commands and reserved names.
- A model supports only thinking off; a query/set fails or the model changes.
- Repeated progress and final image content; invalid or oversized images.
- Concurrent provider sessions, reconnect and attachment access isolation.

## Requirements

### Functional Requirements

- **FR-001**: Command-only submissions MUST finish without waiting for nonexistent model work.
- **FR-002**: Completion MUST account for automatic continuation; cancellation/exit releases work once.
- **FR-003**: Users MUST be able to select any option and confirm or decline accurately.
- **FR-004**: Input/editor text MUST preserve exact submitted content, prefill and hints, with safe cancellation.
- **FR-005**: Discovery MUST include loaded skills, extensions and templates with stable invocations.
- **FR-006**: Thinking choices/settings MUST match the current model or an explicit documented fallback.
- **FR-007**: Valid PNG tool images MUST display once with retained text and survive saved local/remote history.
- **FR-008**: Invalid, oversized or unavailable optional data MUST fail explicitly without crashing or false success.
- **FR-009**: OMP and affected shared Agent behavior MUST retain regression coverage.
- **FR-010**: Desktop and remote sessions MUST share supported interaction semantics.
- **FR-011**: Delivery MUST record tested versions, results and limits, distinguishing untested from unsupported.

### Key Entities

- **Submission**: Acceptance, ongoing work, completion and cancellation state.
- **Interaction**: Identity, kind, choices, text hints, expiration and reply.
- **Command**: Stable name, description, origin and invocation.
- **Model capability**: Active model, available thinking levels and applied selection.
- **Tool image**: Identity, MIME, content and persisted attachment reference.
- **Compatibility record**: Version, capability, validation evidence and limits.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every command-only regression permits another submission without cancellation.
- **SC-002**: Every supplied option is selectable; submitted text and newlines remain exact.
- **SC-003**: All three loaded-command kinds are discoverable; failed settings never appear applied.
- **SC-004**: Every valid final PNG appears exactly once and survives local/remote history reopen.
- **SC-005**: Affected Agent/history/remote regressions pass; unverified environments are recorded.

## Assumptions

- This is a personal fork; upstream contribution procedures are not required.
- Target Pi is 1.0.1; OMP's version is recorded during implementation.
- Existing authentication, persisted sessions and Monocode queue ownership remain.
- Acceptance targets desktop and desktop-connected remote Host sessions; full new
  multiline/image UX on mobile is deferred. Existing mobile flows remain compatible.
- Output PNGs are limited to 20 MiB; text/editor replies are limited to 10,000
  characters to match the current remote limits, with visible errors beyond them.
- Meaningful automated regressions are part of this upgrade; real-model smoke results are separate.
- PNG is the initial output format supported by the existing image-save API.
  Broader image formats are deferred and must not be silently discarded.
- New MCP management UI, widgets, full session-tree features and native queue
  ownership are deferred. Existing Pi-configured MCP can continue running.
- Verification records distinguish automated/UI-fixture/real-RPC evidence from
  unrun native GUI, paid-model, and other-platform checks.
