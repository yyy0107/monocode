# Context contract

HarnessEvent.context remains { type: "context", used?: number, window?: number }.
Session.context remains { used: number, window?: number }; its newest level
replaces earlier usage and optional windows merge through the existing reducer.
There is no migration or Host protocol version change.

Mobile requires a finite, nonnegative used value. It prefers a finite positive
session window, otherwise accepts a finite positive contextWindow from the Host
catalog entry whose harness and full model id both match the current session.
The display fallback does not mutate or persist session.context.

Cursor usage_update accepts the standard used and size fields and maps size to
window. Child context never replaces parent context. Missing or invalid required
fields produce no event. Explicit zero used is valid.

Current ACP field semantics are defined by the primary SDK reference:
[UsageUpdate](https://agentclientprotocol.github.io/typescript-sdk/types/UsageUpdate.html).

Pi/OMP session totals, Claude turn totals and ACP cost/turn metrics must not be
substituted for a current context level. No token estimate or fixed window table
is introduced by the mobile fallback.

Claude's optional control reads use the existing unique control request IDs.
get_binary_version gates summary support at 2.1.257; get_context_usage(summary)
maps totalTokens to used and rawMaxTokens (or maxTokens when absent) to window.
Both values must be finite and valid. This provider-native summary can include
CLI estimates; Monocode does not compute a new estimate itself. Unknown versions,
unsupported methods, timeouts, cancellation and stale responses preserve prior
assistant/result readings. No read sends a user message or starts inference.

Summary-mode version evidence:
[Anthropic SDK changelog, 0.3.257](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md).
