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

## Manual LAN publication

The user runs builds and LAN publication manually. Do not configure automatic
publication hooks or build/publish at the end of a turn. Do not fall back to
agent-run publication when hooks are unavailable. Run builds or publication only
when the user explicitly requests them, after relevant checks pass.

For mobile publication, use `npm run mobile:publish` (`mobile/task-publish.sh`).
It rejects overlapping invocations and skips publication if inputs change during
the build. Do not run `mobile:apk` or Android Studio builds concurrently with it.

For desktop publication, use `npm run desktop:publish`
(`scripts/desktop-task-publish.sh`) on the Linux update server.

It builds DEB and AppImage locally and NSIS via `ssh wy-win`, using
`C:\Users\wy777\Documents\ohmymonocode` as the remote build repository.
Transfer the current source snapshot into its ignored `build/windows-lan/workspace`
directory; never reset or overwrite the Windows checkout or build from its stale HEAD.
Sign all three packages with the existing local key (do not send it to Windows),
and deploy packages before atomically
replacing the LAN update feed. It assigns an increasing `next-patch-lan.N`
version through an ignored Tauri config, without rewriting repository versions.
Already-published source states are skipped. A shared lock rejects
overlapping desktop publications across worktrees; source changes during build,
signing or deployment prevent the feed from being replaced. Both desktop platforms
must succeed at the same version before the feed advances. The remote builder also
locks its workspace; after a crash, inspect the lock owner and processes before
removing a stale `build/windows-lan/build.lock` directory.

Do not run direct Tauri builds concurrently with desktop publication. Report only
observed publication results. Pushing and merging require their own scope.
