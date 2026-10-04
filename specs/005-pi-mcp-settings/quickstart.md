# Validation

Validated 2026-10-04 against local main `47a5398` plus this change. Installed Pi:
1.0.2. The original upgrade commit is `5e06b0b`; its specification explicitly
deferred new MCP management UI. No Pi/OMP protocol code changed here.

| Check | Result |
| --- | --- |
| Affected settings/cache/picker and Pi/OMP adapter tests | 76 passed |
| `cargo test mcp` | 21 passed |
| `npm run check:web` | 4457 passed, 13 skipped; TypeScript passed |
| `npm run test:host` | 176 passed, 5 skipped |
| `npm run check:rust` | fmt and clippy passed; 513 passed, 1 ignored |
| `npm run build` | Passed; Vite reports its bundle-size warning |
| Installed Pi 1.0.2 `mcp list --json` with isolated disabled config | Passed; custom agent directory, deferred exposure and disabled state accepted; no server/model calls |
| Development application | Existing Tauri watcher restarted the debug process after the Rust changes |

Settings → MCP connections → Show all providers reveals Pi without a configured
server. Add MCP server offers Pi with project and user scopes. Configured Pi rows
appear by default and support the same filter, Show config and HTTP Sign in flow
as other providers. The message MCP picker can select them in Pi sessions.

Discovery displays configuration, not live connection health. Pi owns project
trust and configuration validation; changing a file does not reload a running
session automatically. Real OAuth/browser sign-in, live MCP calls, Windows and
macOS were not exercised. CLI dispatch with the configured Pi executable was
tested with an isolated fake binary. Unrelated mobile edits were preserved.

## Native health follow-up (2026-10-04)

Settings and the Pi message picker now share an asynchronous native health read
using the active configured Pi executable's `mcp list --json`. Pi labels and tool
counts update after discovery. Connected public HTTP servers have no Sign in
button; needs-auth rows invoke the existing native login command and refresh
health afterward. Failed, disabled, pending, superseded and unloaded Pi entries
are not selectable. Native errors/trust notes remain visible without translation;
application-owned status/count labels support Chinese. The CLI check creates its
own temporary MCP connection and does not describe or reload an active session.

| Check | Actual result |
| --- | --- |
| Affected Pi status/settings/cache/picker/composer tests | 93 passed |
| `cargo test pi_mcp_status` | 2 passed; configured executable, nonzero valid reports, malformed JSON and credential metadata omission covered |
| `npm run check:web` (final run) | 4498 passed, 13 skipped; TypeScript passed |
| `npm run test:host` | 176 passed, 5 skipped |
| `npm run check:rust` (final run) | fmt/clippy passed; 515 passed, 1 ignored |
| `npm run build` (final run) | TypeScript and Vite passed; existing bundle-size warning |
| Installed Pi `--version` | 1.0.2 |
| Installed Pi `mcp list --json`, existing LangChain docs config | Connected, 3 tools, 1 resource, no errors; no model or tool calls |
| Installed Pi with isolated agent/project configs and a local HTTP 401 server | Exit 1 with needs-auth; disabled stdio entry stays disabled; untrusted project entry excluded with native trust note; no browser login/model calls |
| `git diff --check` | Passed |

The first full web run had all 4495 tests pass, then TypeScript rejected the new
use of Object.hasOwn under ES2020. That was corrected to hasOwnProperty.call.
Later full runs encountered nine, then four, mobile test failures while unrelated
MobileApp, drawer/settings and test files were being updated in the shared
workspace. Those edits were preserved. After the independently updated mobile
tests arrived, the final complete check:web passed, including TypeScript. An
initial Rust full run also hit the existing advisory lease release test once;
its individual rerun and the final complete check:rust both passed.

Real OAuth browser completion/logout, MCP tool invocation, active-session reload,
Windows and macOS remain unverified. Authentication-required native status was
tested with HTTP 401; that is separate from a completed OAuth sign-in. No Pi/OMP
RPC or Host protocol changed.
