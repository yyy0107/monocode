# Verification and compatibility

Date: 2026-10-04. Base: `2f4b36e`. Branch: `codex/native-session-titles`.

## Executed checks

| Command | Result |
| --- | --- |
| `npm run check:web` | PASS: 4356 tests, 13 skipped; TypeScript passed |
| `npm run test:host` | PASS: 163 tests, 5 skipped; Host typecheck/build passed |
| `npm run build` | PASS; existing CSS highlight, mixed-import and chunk-size warnings |
| `npm run check:rust` | PASS: formatting and Clippy; 511 tests passed, 1 ignored |
| `MONOCODE_TITLE_SMOKE_CWD=/projects/monocode node scripts/session-title-smoke.mjs` | PASS: native Codex metadata title read, no model prompt; no matching Claude native-title sample |

Rust validation needed the existing Linux desktop Host resource directory. The
worktree's Host build and provider guard were copied into ignored
`build/desktop-host`, with the installed Node 24.16.0 executable. This is a local
test resource, not a release package or verification of the pinned release runtime.

## Actual installed versions

| Provider | CLI version observed |
| --- | --- |
| Codex | 0.160.0 |
| Claude | 2.1.289 |
| Cursor | 2026.10.01-e373342 |
| Pi | 1.0.2 |
| OMP | 18.6.0 |
| OpenCode | 1.18.34 |
| Grok | 1.0.46 (2765805b9442) |
| fx | 0.0.12 |
| Hermes | 0.21.5+6977.gaf90026, upstream af90026a |
| Antigravity CLI | 1.2.16; standalone ACP server version not verified |

## Coverage and limits

Automated regressions cover source ownership, manual/legacy protection, initial
Pi binding, native ID changes, delayed titles, one durable fallback attempt,
coordinator recreation, cancellation, automation refresh, Chinese titles,
metadata pagination/capability checks, Claude account paths/symlink boundaries,
desktop/Host persistence and remote draft title handoff. Native Codex/Cursor
notifications are tested after turn completion. Host metadata changes retain
transcript revision stamps and activity timestamps. Grok summary notifications
request a title re-read rather than becoming a title themselves.

The native read-only smoke exercises the production cold Codex reader through
the Host child backend and retrieves an existing name. It does not create a
conversation, invoke inference, expose private titles, or prove first-turn
auto-naming. Claude file-reader ownership/format behavior is tested with fixtures;
no matching real title sample was found in the selected default credential home.

Real paid-model first-turn title generation, actual fallback model availability
for every account, native GUI operation, Windows/macOS execution, and real
first-turn ACP metadata from the other providers were not exercised. Offline
transport regressions and CLI version output are not claims of those scenarios
passing. Native misses/errors retain the seed and use the configured one-attempt
fallback. All source changes stay in the new worktree; no provider was installed,
and nothing was pushed, published or merged.

Spec Kit extension hook configuration is absent; pre/post hooks were skipped.
