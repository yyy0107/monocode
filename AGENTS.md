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

## Mobile LAN publication at the end of a turn

The user authorizes automatic LAN APK publication when a completed conversation
turn changes mobile-related source. `.codex/hooks.json` records the source state
on `UserPromptSubmit` and compares it on `Stop`; changed inputs trigger the guarded
`npm run mobile:publish` workflow. Interrupted turns do not publish. Run the
relevant checks before finishing an editing turn, and preserve unrelated work.

Do not also launch a manual build when the hook is active. If hooks are unavailable,
compare mobile inputs at the start/end of the turn and use `npm run mobile:publish`
once when they changed and relevant checks passed. No publication is needed for
docs-only, tests-only or unrelated desktop/Host changes. Report only publication
results actually observed; the Stop hook runs after the final response.

Do not run `mobile:apk` or Android Studio builds concurrently with this workflow.
It rejects overlapping hook invocations and skips publication if inputs change
during the build. LAN publication is authorized; pushing and merging still require
their own scope.

## Desktop LAN publication at the end of a turn

The user also authorizes automatic Linux x64 and Windows x64 desktop LAN publication when a
completed turn changes desktop inputs. The shared `scripts/turn-publish.mjs`
hook snapshots both targets before building, then runs mobile and desktop
publication sequentially. Desktop inputs include desktop/shared UI, Rust,
bundled Host, assets and build/publish configuration; mobile-only code, tests,
ordinary documentation and generated outputs do not trigger desktop builds.

Use the guarded `npm run desktop:publish` workflow on the Linux update server.
It builds DEB and AppImage locally and NSIS via `ssh wy-win`, using
`C:\Users\wy777\Documents\ohmymonocode` as the remote build repository.
Transfer the current source snapshot into its ignored `build/windows-lan/workspace`
directory; never reset or overwrite the Windows checkout or build from its stale HEAD.
Sign all three packages with the existing local key (do not send it to Windows),
and deploy packages before atomically
replacing the LAN update feed. It assigns an increasing `next-patch-lan.N`
version through an ignored Tauri config, without rewriting repository versions.
Interrupted, planning and unchanged turns are skipped. A shared lock rejects
overlapping desktop publications across worktrees; source changes during build,
signing or deployment prevent the feed from being replaced. Both desktop platforms
must succeed at the same version before the feed advances. The remote builder also
locks its workspace; after a crash, inspect the lock owner and processes before
removing a stale `build/windows-lan/build.lock` directory.

Do not also run a manual desktop build when the hook is active, and do not run
direct Tauri builds concurrently with desktop publication. If hooks are
unavailable, compare desktop inputs at turn start/end and run `desktop:publish`
once after relevant checks pass when inputs changed. Report only observed
publication results; the Stop hook runs after the final response. Hook changes
must be reviewed and trusted in Codex before automatic execution begins.
