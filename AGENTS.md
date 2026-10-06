# Monocode Personal Fork Development

This repository is the user's personal fork. Follow direct user instructions and
the existing architecture. Upstream issues, pull requests and maintainer approvals
are not prerequisites for local work.

## Project Rules

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

## Development Workflow

Implement directly from the user's requirements and the existing code. Use a
concise plan when useful, and keep documentation proportional to the change.
Existing records under `specs/` are historical references. Maintain them only
when the user requests it; they are not prerequisites for development.

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
