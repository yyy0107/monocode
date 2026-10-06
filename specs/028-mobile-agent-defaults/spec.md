# Feature: Mobile Agent defaults

Created: 2026-10-05. Status: Implemented; automated verification in verification.md.

Mobile reuses the Host's existing Agent model catalog and desktop-published
Codex/Claude account choices. Preferences belong to this phone, are isolated by
Host environmentId, and never change desktop preferences.

## Requirements and acceptance

- Settings exposes a New conversations group even before a project exists.
- Each Host has a default Agent; each Agent retains its own model, reasoning
  settings and account. Switching Agents restores those values.
- All new-conversation entry points apply these defaults. A draft captures its
  defaults when opened; later Settings changes do not change that draft or an
  existing conversation. Composer changes are temporary.
- Use the actual Host catalog's setting IDs/options, including Pi/OMP thinking
  and OpenCode variant. Keep supported values; use catalog defaults otherwise.
- Missing models fall back within the preferred Agent, then fixed provider order.
  Show the effective choice without overwriting stored preferences.
- Select existing accounts only. Credentials and account management stay on the
  computer. Missing accounts remain visible and cannot silently become default.
- Isolate catalogs and async results across Host switches, disconnects and reconnects.
  Unsupported account RPC is distinct from a retryable network error.
- Migrate old unscoped defaults once to the first verified Host; validate old
  account IDs against its account list before use.
- Localize application-owned text in English/Chinese and reuse existing animated
  sheets/selectors. Preserve account names, model IDs and raw option values.

Account management, usage meters, hidden Agents, per-project defaults and desktop
preference synchronization are outside this change. Existing mobile appearance,
notifications, follow-up behavior and transcript preferences stay as they are.
