# Monocode Personal Fork Development

This repository is the user's personal fork. Follow direct user instructions and
the existing architecture. Upstream issues, pull requests and maintainer approvals
are not prerequisites for local work.

## Project Rules

- Read `.specify/memory/constitution.md` before planned feature implementation.
- Preserve unrelated work and use focused changes; avoid unsolicited refactors.
- Provider protocols live under `src/integrations/harness/providers/`; shared
  contracts live under `src/integrations/harness/core/`.
- Pi and OMP share `piFamily.ts`; verify both when changing shared behavior.
- Desktop and headless Host reuse adapters, but runtime image persistence differs.
- Keep optional question/image fields compatible with existing consumers and history.
- Application-owned text follows `docs/localization.md`; preserve provider/user values.
- Expand/collapse interactions MUST animate in both directions. Reuse
  `src/shared/ui/AnimatedCollapse.tsx` for vertical disclosure content and the
  exported `useCollapseMotion` plus `animated-collapse-size` styles for grid-sized
  panels; do not reimplement fold state/timers per view. Grid panels keep stable
  zero-sized tracks while closed and disable transitions during direct resizing.
  Running terminals stay mounted while hidden so collapsing never kills a PTY.
  Keep content mounted until closing finishes, disable hidden/closing interaction
  and portals, handle rapid reversal, and respect `prefers-reduced-motion`.
  Apply this rule to new or modified disclosure UI as a standing requirement;
  it does not need to be restated in each feature request.

## Spec Kit

The active feature is recorded in `.specify/feature.json` and lives in
`specs/017-desktop-shell-overhaul/`. Read spec.md, plan.md, contracts and tasks.md together.
The native session titles record remains in `specs/004-native-session-titles/`.
The completed native session synchronization record remains in
`specs/002-native-session-sync/`.
The completed Pi upgrade record remains in `specs/001-pi-1-0-1-upgrade/`.
Codex skills use `$speckit-constitution`, `$speckit-specify`, `$speckit-plan`,
`$speckit-tasks`, `$speckit-analyze`, `$speckit-implement` and `$speckit-converge`.
Toolkit initialization or artifact quality checks do not prove product implementation.

## Verification

Run affected tests during development. For this adapter upgrade, complete
`npm run check:web`, `npm run test:host` and `npm run build`; run
`npm run check:rust` when Rust changes. Record actual CLI versions and test results.
Never mark tasks complete or claim compatibility for an unrun scenario.
Publishing, pushing and merging into main are separate scoped operations.

The installed Spec Kit release does not bundle an agent-context update script;
this file provides the project context directly without inventing a legacy command.
