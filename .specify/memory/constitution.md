<!--
Sync Impact Report
Version: unfilled template -> 1.0.0 (initial adoption for the personal fork).
Principles: bounded fork changes, shared contracts, protocol isolation, evidence,
validation proportional to impact. Added: compatibility records and workflow.
Templates: spec/plan/tasks templates reviewed; existing sections remain suitable.
Generated command guidance: constitution/specify/plan/tasks skills reviewed.
Deferred placeholders: none.
-->
# Monocode Personal Fork Constitution

## Core Principles

### I. Bounded Changes for the Personal Fork

Changes MUST serve the user's fork and requested feature. Upstream issues,
pull requests and maintainer approvals are not delivery requirements.
Preserve unrelated local features and follow the current module structure.
Separate unrelated refactors and new product surfaces.

### II. Shared User Contracts

Adapters MUST translate native protocols into the shared lifecycle and events.
Reuse questions, images, tools and status UI. Optional capabilities MUST remain
optional for other adapters. Persisted sessions MUST remain readable unless an
explicitly scoped migration is required.

### III. Provider Protocol Isolation

Provider-specific lifecycle, queue, command and error semantics MUST stay in the
adapter. Changes to shared Pi/OMP modules MUST preserve both behaviors and include
regressions for both. Protocol parsing MUST be independently testable.
New provider fields MUST not require unrelated adapters to emit them.

### IV. Evidence-Based Compatibility

Compatibility records MUST distinguish tested, untested and unavailable features
and state actual CLI versions. Version-parsing examples are not compatibility
evidence. Fixtures MUST preserve semantics and remove credentials/private data.
Never report checks or real-model sessions as passing unless they passed.

### V. Validation Proportional to Impact

Protocol/lifecycle changes MUST have meaningful regressions for failure behavior.
Shared adapter changes MUST exercise desktop-facing and headless Host paths.
Shared UI/state changes MUST cover existing consumers. Documentation changes
require artifact validation, not application tests. Reuse existing dependencies.

## Compatibility Records

Each upgrade MUST record its source baseline, target CLI, affected adapters,
in-scope outcomes, deferred features, executed checks and remaining limits.
Pi and OMP evolve independently. A missing optional method MUST have a documented
fallback or unavailable state. Keep Monocode's existing queue ownership until
a separately specified queue integration.

## Development Workflow

Capture bounded requirements in spec.md, design in plan.md/contracts, and
dependency-ordered work in tasks.md. Establish regressions before protocol repairs.
Implement and validate each story. Use focused local commits. Publishing,
pushing and merging into main require scope in the user's request.

During development run affected tests. Before this adapter upgrade is complete,
run npm run check:web, npm run test:host and npm run build. Run npm run check:rust
when Rust changes. Unexercised environments remain unverified.
Application-owned labels follow docs/localization.md; provider content,
commands, option values and user-entered text preserve their original values.

## Governance

Direct user instructions and host permission boundaries take precedence.
Amendments MUST record rationale and reconcile dependent artifacts.
Use major versions for incompatible rules, minor for additions and patch for
clarifications. Check compliance during planning and completion without extra
approval rounds for ordinary authorized work.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
