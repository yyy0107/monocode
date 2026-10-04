# Pi MCP contract

`McpConnection.provider` accepts `pi`; existing response fields are unchanged.
`mcp_discover` lists metadata from user and selected-project `mcpServers` maps.
User path is `$PI_CODING_AGENT_DIR/mcp.json` when nonempty, otherwise
`~/.pi/agent/mcp.json`; project path is `<cwd>/.pi/mcp.json`. Both scopes remain
visible when a project overrides a same-name user server, like other providers.

`mcp_add` accepts `pi` with `project` or `user` scope and a standard JSON server
entry or one-entry `mcpServers` object. Preserve native optional fields such as
enabled, exposure, toolExposure, timeout, OAuth and description. Reject duplicate
entries without altering the existing file.

`mcp_provider_login` invokes the configured Pi executable with `mcp login <name>`.
Configured metadata is not runtime health. Pi retains responsibility for native
validation, project trust and loading/reloading active sessions.

`pi_mcp_list(cwd)` runs the configured Pi binary with `mcp list --json` and a
60-second timeout. The response includes `servers` (name, native scope/source,
enabled, state, toolCount, optional resource counts/override/error), `errors` and
optional `note`. Valid reports are returned even with exit code 1. Invalid JSON,
CLI failures or timeouts reject without returning raw stdout/configuration.

Frontend connections gain optional `nativeState`, `toolCount` and `statusDetail`.
Pi native states are connected, needs-auth, failed, disabled, connecting,
disconnected and closed. Application states checking, unavailable, not-loaded
and overridden represent pending checks, unsupported checks, absent native
entries and superseded scopes. Only connected Pi entries are selectable after
a health check; only needs-auth entries offer login. Configuration-only consumers
and other providers remain compatible. Native scope global maps to user;
native source matches configPath. Native errors and trust notes remain verbatim.
