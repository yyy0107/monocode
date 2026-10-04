# Mobile context usage across agents

Date: 2026-10-04.

User clarification: Claude Code has no mobile context display; Pi and Codex do.
Claude must also read its available native context-summary control API, rather
than relying only on optional result.modelUsage window metadata.

The mobile context indicator consumes provider usage through the existing Host
session contract. Users should see available context information for any agent,
including readings that contain tokens but omit the model window.

Accept native windows first, then the exact active model's Host catalog window.
Never synthesize usage from a model limit alone. Show remaining percentage and
tokens when both values are available, tokens with an unknown-window label when
only usage is available, and an explicit not-reported state otherwise. The header
ring and status sheet must use the same reading. Keep existing provider/user text
and localize new application-owned labels.

Cursor must accept standard ACP usage_update notifications, exclude attributed
subagents, and reject invalid numbers. Preserve the existing context contract,
provider-specific accounting, model configuration, persistence and unrelated
working changes. Real paid model sessions and mobile native deployment are not
part of this change.
