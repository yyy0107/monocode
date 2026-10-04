# Design

Host snapshots store optional `lastReplyRevision` and `lastCompletedRunId`.
Summaries add stable input request identities. `sessions.activity` returns all
project summaries with the Host identity under the existing authenticated RPC
guard, without transcripts or Git branch probes.

Read and delivery cursors live on each device. Android's tracker is authoritative
for its WebView and service, stores cursors in private SharedPreferences and
serializes observations/read acknowledgements. Connection credentials remain in
the existing encrypted storage; the service holds its validated configuration
only in memory. Identity/authentication rejection stops reception; transient
failures back off. Native HTTP disables redirects, bounds responses and uses the
protocol version and pinned environment ID.

The mobile hook monitors all projects while foregrounded and acknowledges only
rendered snapshots. Android's service polls while the WebView is suspended and
uses high-importance reply notifications plus a quiet ongoing reception channel.
Notification identities deduplicate repeated polls and remain scoped by Host.
Browser/iOS foreground unread cursors use the corresponding local state model.

Reuse current dependencies and provider adapters. Run UI/state, RPC, queue and
Java unit regressions, Android compile, Web/Host checks and both web builds.
If an isolated Android emulator is available, run a native background reception
test without publishing its APK. Record actual executed and unrun scenarios.
