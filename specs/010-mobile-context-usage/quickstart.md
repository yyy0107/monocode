# Verification and provider findings

Date: 2026-10-04.

## Provider paths

| Provider | Existing data path / change |
| --- | --- |
| Codex | thread/tokenUsage/updated supplies the last request and model window |
| Claude | assistant/result fallback plus newly added get_context_usage(summary) supplies a native current level and full window |
| Pi / OMP | assistant usage + get_state.model.contextWindow; get_session_stats.contextUsage refines the level |
| OpenCode | assistant message tokens + catalog limit.context |
| Grok | ACP usage/turn_completed; setup metadata can supply the window |
| Hermes | Shared ACP parser handles usage_update.used/size; installed server emits these fields |
| fx / Antigravity | Their ACP parsers already translate usage fields |
| Cursor | Added previously missing standard ACP usage_update handling |

The mobile UI previously hid the context field unless both used and window were
available. It now displays partial or unavailable readings explicitly and can
fill a missing window from the exact model in the Host catalog. A provider that
does not send usage still cannot have a meaningful percentage displayed.

## Executed evidence

- Initial Cursor regression failed because it emitted no context events.
- Affected suite passed: 123 tests in six files (mobile helper/status, Cursor,
  OpenCode, Pi and OMP).
- Headless production-adapter transport suite passed: 24 tests. Synthetic
  provider frames cover Codex, Claude, Pi, OMP, Cursor, Grok, fx, Hermes and
  Antigravity; reopened Host databases and serialized session sync preserve
  their readings. OpenCode is covered separately through its SSE adapter.
- Isolated native Pi 1.0.2 RPC read passed on a temporary session and custom
  model: get_state window 100000; get_session_stats.contextUsage tokens 25000,
  window 100000, percent 25.
- Isolated native OMP 18.6.0 RPC read passed on the same fixture: window 100000;
  contextUsage tokens 24000, percent 24. Its context calculation differs from
  Pi's; the adapter already preserves the native reported reading.
- Those reads used a disposable directory, synthetic history and an unreachable
  local fixture endpoint without sending any prompt. An initial OMP smoke attempt
  used Pi's unsupported --no-prompt-templates flag and timed out; corrected OMP
  flags (--no-rules, --no-title) passed. An initial Pi run without a registered
  model correctly omitted contextUsage, demonstrating the unknown-model case.
- User confirmed the missing display is Claude Code; Pi and Codex already display
  it. Claude previously had no get_context_usage path and depended on optional
  result.modelUsage window metadata.
- Isolated native Claude 2.1.289 get_binary_version and get_context_usage(summary)
  passed without a user prompt, with a disposable config, hooks/MCP disabled and
  ANTHROPIC_BASE_URL pointed at an unreachable local port. Native summary returned
  totalTokens 44289, maxTokens/rawMaxTokens 200000 and percentage 22 for
  claude-sonnet-4-6. These are the CLI's estimates for its initial context,
  not a paid model-response measurement.
- Claude protocol/live regression suite passed: 93 tests. Covers absent modelUsage,
  rawMaxTokens precedence, invalid fields, version < 2.1.257, unsupported controls,
  bounded timeouts, cancellation and retained fallback data. Host fixtures now
  omit Claude result.modelUsage and supply the window only through the new query.

## CLI versions observed in this run

| Provider | Actual output |
| --- | --- |
| Codex | codex-cli 0.160.0 |
| Claude | 2.1.289 (Claude Code) |
| Cursor | 2026.10.01-e373342 |
| Pi | 1.0.2 |
| OMP | omp/18.6.0 |
| OpenCode | 1.18.34 |
| Grok | grok 1.0.46 (2765805b9442) |
| fx | 0.0.12 |
| Hermes | v0.21.5+6977.gaf90026; upstream af90026a |
| Antigravity | --version exited successfully without version output; version unverified here |

## Limits

Real-model sessions for all ten agents, actual Cursor usage_update emission,
personal imported sessions, and Android/iOS device behavior remain unverified.
Tests establish how the adapters handle supplied protocol data; they do not prove
that every installed agent/model emits a window or usage on every turn.

## Full checks

- test:host passed: 177 tests, 5 skipped; Host typecheck/build passed.
- Final build and mobile:build passed with the Claude-native change, including
  desktop/mobile TypeScript and mobile tools typecheck.
- check:web first failed on the old hidden-context assertion, which was updated
  for the explicit not-reported state. A second full run failed four existing
  Codex image-persistence tests; its isolated repeat passed all 74 tests, and the
  next full rerun passed. After adding Claude-native reads and version gating,
  the final full run passed 4642 tests, 13 skipped; TypeScript passed.
- Builds retain existing CSS highlight and large-chunk warnings; Host build also
  reports the pre-existing duplicate Checking connection… translation key.
- Rust was unchanged; check:rust was not run for this fix.
