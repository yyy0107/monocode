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

The active feature is recorded in `.specify/feature.json`. Read spec.md, plan.md,
contracts and tasks.md together from that directory. The Host orchestration
record lives in `specs/019-host-orchestration/`; the desktop shell record remains
in `specs/017-desktop-shell-overhaul/`.
The multi-agent native session sync record (Claude Code, Codex, Pi, omp, OpenCode)
lives in `specs/021-multi-agent-session-sync/`.
The Host-owned native session lifecycle record lives in
`specs/030-host-native-sessions/`; history mapping (031) and the cross-platform
`native-guard` (032) follow it.
The Host assistant record lives in `specs/022-host-assistant/`; its human-like
conversation follow-up (persona, local time, reminders, steering) lives in
`specs/027-assistant-humanlike/`.
The native session titles record remains in `specs/004-native-session-titles/`.
The completed native session synchronization record remains in
`specs/002-native-session-sync/`.
The completed Pi upgrade record remains in `specs/001-pi-1-0-1-upgrade/`.
Codex skills use `$speckit-constitution`, `$speckit-specify`, `$speckit-plan`,
`$speckit-tasks`, `$speckit-analyze`, `$speckit-implement` and `$speckit-converge`.
Toolkit initialization or artifact quality checks do not prove product implementation.

## Verification

Keep verification proportional to the change and minimize unnecessary testing.

- Run the smallest relevant existing tests for changed behavior; do not run full
  suites by default.
- Documentation-only changes do not require tests. For reversible, low-risk
  presentation changes, use a focused inspection or check instead of adding tests.
- Add tests only for meaningful behavior or regression risks; avoid tests that
  merely mirror the implementation.
- Once relevant checks pass, do not repeat or broaden them unless further changes,
  failures, or unresolved risks justify it.
- Use `npm run check:web`, `npm run test:host` and `npm run build` only when their
  scope is relevant or the task explicitly requires them; run `npm run check:rust`
  when Rust changes.
- Record the checks actually run and their results, and actual CLI versions when
  verifying provider compatibility.

Never mark tasks complete or claim compatibility for an unrun scenario.
Publishing, pushing and merging into main are separate scoped operations.

The installed Spec Kit release does not bundle an agent-context update script;
this file provides the project context directly without inventing a legacy command.
