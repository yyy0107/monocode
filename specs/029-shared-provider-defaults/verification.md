# Verification — shared provider defaults

Date: 2026-10-05. Implementation covers Codex and Claude shared account selection;
provider protocol adapters, Pi and OMP were not changed by this feature.

## Automated checks

| Check | Actual result |
| --- | --- |
| Provider account metadata/default selection tests | 12 passed |
| Native publication, import orchestration and identity routing tests | 6 passed |
| Usage-query routing tests | 2 passed |
| Desktop Settings tests | 48 passed |
| Desktop RemoteSession tests | 41 passed |
| Mobile default storage tests | 10 passed |
| Mobile default settings/create flow tests | 12 passed |
| Desktop UsageFooter/UsageFooterAuth/UsageProviderChip tests | 20 passed |
| Host account metadata/default resolver tests | 3 passed |
| Host engine tests | 39 passed |
| Host server tests | 27 passed |
| Host child backend tests | 8 passed |
| `npm run check:rust` | Passed: formatting, Clippy with denied warnings, 540 Rust tests passed, 1 ignored |

The Vitest commands targeted only these files (228 distinct tests in total), not
full web or Host suites. Focused follow-up runs exercised fixes and final error
localization. Existing React act warnings remain in the RemoteSession running-turn
settings test; its assertions pass.

Native tests use temporary auth/config fixtures and verify private Unix file modes,
no session-history copy, destination non-overwrite, partial-copy cleanup, published
profile validation and preservation of the other provider's preference.
Host engine fixtures verify Codex and Claude resolution at creation, explicit
named/original-CLI overrides, stable retained account binding and missing defaults.
Child-process fixtures verify profile environment isolation and rejection of a
removed profile directory without recreating it.

## Semantics and limits

- Unspecified new conversations follow the configured shared default. An explicit
  desktop project account overrides it; mobile's follow-default selection omits
  the account ID. Existing sessions never re-resolve through the new preference.
- Clearing a shared preference retains the legacy Host CLI environment behavior.
  A configured named profile is deterministic and does not depend on who launched
  the desktop or Host.
- Ordinary desktop identities come from the Host. Native desktop imports retain
  their local identity source. No desktop-identity fallback occurs after a failed
  Host read. API-key environment overrides suppress misleading cached OAuth labels.
- Default Host CLI usage cannot safely use the desktop process's credentials;
  it reports unavailable. Named profile usage remains available. This feature
  does not add a Host usage RPC.
- Current Codex login import operates only on a readable file credential store;
  keychain-only credentials require the existing named-account sign-in flow. The
  imported profile uses its own file credential store and keeps optional config.
- The installed desktop/Host service was not restarted or reconfigured. No actual
  credentials were imported and no live account preference was changed. The new
  UI/commands require the updated desktop and Host builds.
- No real Codex/Claude provider call, real-device mobile run, Windows/macOS runtime
  test, signing flow or credential refresh was performed. CLI versions and real
  Provider compatibility are therefore not asserted. Identity fixtures contain
  synthetic claims; the earlier server assertion was adjusted to allow the new
  optional metadata and isolate test account homes.

## Final builds

- `npm run build` passed (TypeScript and desktop Vite build).
- `npm run host:build` passed (Host TypeScript and bundle generation).
- `npm run mobile:build` passed (web/mobile tools TypeScript and mobile Vite build).
- `git diff --check` passed.

Both Vite builds report existing large-chunk advisories; they completed successfully.
No artifacts were published and no branch was pushed or merged.
