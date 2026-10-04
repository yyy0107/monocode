# Pi MCP settings

Expose Pi's native MCP configuration in the existing desktop MCP settings and
message picker. The Pi RPC upgrade (`5e06b0b`) deferred this UI integration.

Read user servers from `~/.pi/agent/mcp.json`, respecting `PI_CODING_AGENT_DIR`,
and project servers from the selected directory's `.pi/mcp.json`. Pi does not
inherit parent MCP files. Display configured and disabled entries without
exposing credentials. Keep the existing filter rule: only configured providers
appear until Show all providers is selected.

Allow adding Pi servers at project/user scope while preserving native fields and
unrelated settings. Reuse Show config for edits and Pi's CLI for HTTP sign-in.
No change to Pi/OMP RPC, project trust, Host commands, or active-session reload.

Follow-up: use the configured Pi executable's `mcp list --json` to report native
connection state and tool counts in settings and the message picker. Load health
in the background without delaying configuration discovery. Only `needs-auth`
offers Pi sign-in; connected public HTTP servers do not. Retain valid JSON when
Pi exits 1 for authentication, connection or configuration failures. Keep rows
when the CLI is unavailable, and show its trust/configuration diagnostics. Match
native reports by name, scope and source so overridden or untrusted project rows
cannot inherit another scope's connected state. A running session's MCP state is
not changed or reloaded by this independent CLI health check.

Acceptance: configured Pi entries are visible/filterable; Pi is offered in the
add dialog and all-provider filter; add targets the correct file; sign-in uses
the active configured Pi executable; Pi entries are selectable only for Pi.
